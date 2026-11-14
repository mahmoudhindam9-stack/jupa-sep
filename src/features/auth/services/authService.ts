import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { Profile } from "@/shared/types";
import {
  DEFAULT_NEW_USER_PASSWORD,
  inspectPasswordResetConditions,
  isDefaultTemporaryPassword,
  normalizeManagedDigits,
  normalizeManagedEmail,
  normalizeManagedUsername,
  sanitizePermissionsForSupabaseRpc,
  validateManagedProfilePayload,
  validateManagedUserForm,
  userValidationErrorMessage,
} from "./managedUserValidation";

const DEFAULT_SUPABASE_URL = "https://myqtvbfibvgxkqwxvuru.supabase.co";
const MYQTV_PROJECT_REF = "myqtvbfibvgxkqwxvuru";
const MYQTV_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cXR2YmZpYnZneGtxd3h2dXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjY0NjgsImV4cCI6MjEwMDQwMjQ2OH0.LDFW826N2GRzG9WnLHgYxoeOcTkDOeLjTiFK6aQ-BSE";

const getSecondaryClient = () => {
  const rawUrl =
    (typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_SUPABASE_URL
      : undefined) ||
    (typeof process !== "undefined" && process.env ? process.env.VITE_SUPABASE_URL : undefined);

  const url =
    rawUrl &&
    typeof rawUrl === "string" &&
    (rawUrl.startsWith("http://") || rawUrl.startsWith("https://"))
      ? rawUrl.trim()
      : DEFAULT_SUPABASE_URL;

  let key =
    (typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      : undefined) || MYQTV_ANON_KEY;

  if (!key || key.startsWith("http://") || key.startsWith("https://")) {
    key = MYQTV_ANON_KEY;
  }

  if (url.includes(MYQTV_PROJECT_REF) && !key.includes(MYQTV_PROJECT_REF)) {
    key = MYQTV_ANON_KEY;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

const normalizeEmail = normalizeManagedEmail;

const assertCredentials = (email: string, password: string) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("A valid email address is required.");
  }
  if (!password) {
    throw new Error("Password is required.");
  }
  return normalizedEmail;
};

export const authService = {
  async isInitialAdminSetupAvailable(): Promise<boolean> {
    const { data, error } = await (supabase as any).rpc("is_initial_admin_setup_available");
    if (error) {
      throw new Error(
        "تعذر التحقق من إعداد المدير الأول. تأكد من تطبيق آخر ترحيل Supabase ثم أعد المحاولة.",
        { cause: error },
      );
    }
    return data === true;
  },

  async hasActiveSupabaseSession(): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return Boolean(session?.user?.id);
    } catch {
      return false;
    }
  },

  async signIn(email: string, password: string) {
    const normalizedEmail = assertCredentials(email, password);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizeManagedDigits(password),
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      const msg = String(error?.message || "").toLowerCase();
      if (msg.includes("auth session missing") || msg.includes("session_not_found")) {
        return session.user ?? null;
      }
      throw error;
    }
    return user ?? session.user ?? null;
  },

  async getProfile(userId: string): Promise<Profile | null> {
    if (!userId?.trim()) throw new Error("User id is required.");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  },

  async getUsers(): Promise<Profile[]> {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at");
    if (error) throw error;
    return (data ?? []) as Profile[];
  },

  async upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
    // Keep every managed-profile write on the same permission-checked server path.
    return await this.saveManagedProfile(profile);
  },

  async saveManagedProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
    validateManagedProfilePayload(profile);
    const rpcPermissions = sanitizePermissionsForSupabaseRpc(profile.permissions || {});

    const { data, error } = await (supabase as any).rpc("upsert_managed_user_profile", {
      p_user_id: profile.id,
      p_username: normalizeManagedUsername(profile.username ?? ""),
      p_full_name: String(profile.full_name || "").trim(),
      p_phone: String(profile.phone || "").trim(),
      p_role: String(profile.role).trim().toLowerCase(),
      p_permissions: rpcPermissions,
    });

    if (error) {
      throw new Error(userValidationErrorMessage(error), { cause: error });
    }
    if (!data || typeof data !== "object" || !data.id) {
      throw new Error("لم يؤكد Supabase حفظ ملف المستخدم. لم يتم اعتماد التغيير.");
    }
    if (profile.email) {
      try {
        await supabase
          .from("profiles")
          .update({ email: normalizeEmail(profile.email) } as any)
          .eq("id", profile.id);
      } catch {
        // Ignore non-fatal email column sync error if schema doesn't expose email update
      }
    }
    return {
      ...(data as Profile),
      ...(profile.email ? { email: normalizeEmail(profile.email) } : {}),
      permissions: {
        ...((data as any).permissions || {}),
        ...(profile.permissions || {}),
      },
    } as Profile;
  },

  async createManagedUserAccount(input: {
    email: string;
    password: string;
    username: string;
    full_name: string;
    phone?: string;
    role: string;
    permissions: Record<string, boolean>;
  }): Promise<{ profile: Profile; sessionConfirmed: boolean }> {
    const effectivePassword = input.password?.trim() || DEFAULT_NEW_USER_PASSWORD;
    const validated = validateManagedUserForm({
      fullName: input.full_name,
      username: input.username,
      email: input.email,
      phone: input.phone || "",
      password: effectivePassword,
      role: input.role,
      hosted: true,
      requirePassword: true,
    });

    const rpcPermissions = sanitizePermissionsForSupabaseRpc(input.permissions || {});

    // Prefer the atomic server-side RPC which creates auth.users + auth.identities + public.profiles
    // even when GoTrue public signups are disabled.
    const { data: rpcProfile, error: rpcError } = await (supabase as any).rpc(
      "create_managed_user_account",
      {
        p_email: validated.email,
        p_password: validated.password,
        p_username: validated.username,
        p_full_name: validated.fullName,
        p_phone: validated.phone,
        p_role: validated.role,
        p_permissions: rpcPermissions,
      },
    );

    if (!rpcError && rpcProfile && typeof rpcProfile === "object" && rpcProfile.id) {
      return {
        profile: {
          ...(rpcProfile as Profile),
          permissions: {
            ...((rpcProfile as any).permissions || {}),
            ...(input.permissions || {}),
          },
        } as Profile,
        sessionConfirmed: true,
      };
    }

    const errMsg = String(rpcError?.message || "").toLowerCase();
    const isMissingFunction =
      rpcError?.code === "42883" ||
      rpcError?.code === "PGRST202" ||
      errMsg.includes("create_managed_user_account");

    if (rpcError && !isMissingFunction) {
      throw new Error(userValidationErrorMessage(rpcError), { cause: rpcError });
    }

    // Fallback to client-side secondary Auth signUp + saveManagedProfile
    const created = await this.signUpNewUser(validated.email, validated.password, {
      username: validated.username,
      email: validated.email,
      full_name: validated.fullName,
      phone: validated.phone,
      role: validated.role,
      must_change_password: isDefaultTemporaryPassword(validated.password),
    });
    if (!created?.user?.id) {
      throw new Error("لم تؤكد Supabase إنشاء حساب المستخدم؛ لم يُضف إلى قائمة المستخدمين.");
    }

    try {
      const savedProfile = await this.saveManagedProfile({
        id: created.user.id,
        username: validated.username,
        full_name: validated.fullName,
        phone: validated.phone,
        role: validated.role as any,
        permissions: input.permissions || {},
      });
      return { profile: savedProfile, sessionConfirmed: Boolean(created.session) };
    } catch (saveError) {
      await this.deleteUser(created.user.id).catch(() => undefined);
      throw saveError;
    }
  },

  async updateManagedUserPassword(userId: string, newPassword: string): Promise<void> {
    if (!userId?.trim()) throw new Error("معرّف حساب Supabase مطلوب.");
    const normalizedPassword = normalizeManagedDigits(String(newPassword ?? ""));
    if (normalizedPassword.length < 8) {
      throw new Error("كلمة المرور يجب ألا تقل عن 8 أحرف.");
    }

    const { data, error } = await (supabase as any).rpc("update_managed_user_password", {
      p_user_id: userId,
      p_new_password: normalizedPassword,
    });

    if (error) {
      throw new Error(userValidationErrorMessage(error), { cause: error });
    }
    if (data !== true) {
      throw new Error("لم يؤكد Supabase تحديث كلمة المرور.");
    }
  },

  async completeOwnPasswordReset(newPassword: string, newEmail?: string): Promise<void> {
    const normalizedPassword = normalizeManagedDigits(String(newPassword ?? ""));
    const normalizedEmail = newEmail ? normalizeEmail(newEmail) : "";
    const inspection = inspectPasswordResetConditions(
      normalizedPassword,
      normalizedPassword,
      {
        forbidDefaultPassword: true,
        ...(normalizedEmail
          ? { personalEmail: normalizedEmail, requirePersonalEmail: true }
          : {}),
      },
    );
    if (!inspection.isValid) {
      throw new Error(
        inspection.unmetSummary[0] ||
          "البيانات غير مستوفية لشروط البرنامج وSupabase.",
      );
    }

    const nowIso = new Date().toISOString();
    let updatedInCloud = false;

    // 1. Try server-side RPC first if available (with email if supported, then fallback to 1-arg)
    if (normalizedEmail) {
      try {
        const { data: rpcDoneWithEmail, error: rpcEmailErr } = await (supabase as any).rpc(
          "complete_own_password_reset",
          {
            p_new_password: normalizedPassword,
            p_new_email: normalizedEmail,
          },
        );
        if (!rpcEmailErr && rpcDoneWithEmail === true) {
          updatedInCloud = true;
        }
      } catch {
        // Fallback below
      }
    }

    if (!updatedInCloud) {
      try {
        const { data: rpcDone, error: rpcErr } = await (supabase as any).rpc(
          "complete_own_password_reset",
          {
            p_new_password: normalizedPassword,
          },
        );
        if (!rpcErr && rpcDone === true) {
          updatedInCloud = true;
        }
      } catch {
        // Fallback to standard GoTrue updateUser below
      }
    }

    // 2. Also call standard GoTrue updateUser so active session & metadata stay in sync
    const { data, error: updateError } = await supabase.auth.updateUser({
      password: normalizedPassword,
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      data: {
        must_change_password: false,
        password_changed_at: nowIso,
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
      },
    });

    if (updateError && normalizedEmail) {
      // If email change failed in GoTrue (e.g. confirmation constraint), still update password & metadata
      const fallbackRes = await supabase.auth.updateUser({
        password: normalizedPassword,
        data: {
          must_change_password: false,
          password_changed_at: nowIso,
          email: normalizedEmail,
        },
      });
      if (!fallbackRes.error && fallbackRes.data?.user?.id) {
        updatedInCloud = true;
      } else if (!updatedInCloud && fallbackRes.error) {
        throw new Error(userValidationErrorMessage(fallbackRes.error), {
          cause: fallbackRes.error,
        });
      }
    } else if (updateError && !updatedInCloud) {
      throw new Error(userValidationErrorMessage(updateError), { cause: updateError });
    } else if (data?.user?.id) {
      updatedInCloud = true;
    }

    // 3. Ensure public.profiles has the updated personal email immediately
    if (normalizedEmail) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await supabase
            .from("profiles")
            .update({ email: normalizedEmail, updated_at: nowIso } as any)
            .eq("id", session.user.id);
        }
      } catch {
        // ignore if RLS blocks direct update; RPC / queueUserChange handles it
      }
    }

    if (!updatedInCloud) {
      throw new Error("لم تؤكد Supabase تحديث كلمة المرور.");
    }
  },

  async sendSupabasePasswordResetEmail(email: string): Promise<string> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new Error("أدخل بريداً إلكترونياً صالحاً لإرسال رابط الاستعادة.");
    }
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : "/reset-password";
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });
    if (error) {
      throw new Error(userValidationErrorMessage(error), { cause: error });
    }
    return redirectTo;
  },

  async deleteUser(id: string): Promise<void> {
    if (!id?.trim()) throw new Error("User id is required.");
    const { data, error } = await (supabase as any).rpc("delete_managed_user", {
      target_user_id: id,
    });
    if (error) throw new Error(userValidationErrorMessage(error), { cause: error });
    if (data !== true) throw new Error("لم يؤكد Supabase حذف الحساب؛ لم يتم اعتماد العملية.");
  },

  async deleteManagedUser(id: string): Promise<void> {
    return this.deleteUser(id);
  },

  async signUpNewUser(email: string, password: string, profileData: any) {
    const normalizedEmail = normalizeEmail(email);
    const validated = validateManagedUserForm({
      fullName: String(profileData?.full_name ?? ""),
      username: String(profileData?.username ?? ""),
      email: normalizedEmail,
      phone: String(profileData?.phone ?? ""),
      password,
      role: String(profileData?.role ?? ""),
      hosted: true,
      requirePassword: true,
    });
    const secondaryClient = getSecondaryClient();
    const { data, error } = await secondaryClient.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: {
        data: {
          ...profileData,
          username: validated.username,
          full_name: validated.fullName,
          phone: validated.phone,
          role: validated.role,
          must_change_password: isDefaultTemporaryPassword(validated.password),
        },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/reset-password`
            : undefined,
      },
    });
    if (error) throw new Error(userValidationErrorMessage(error), { cause: error });

    // Supabase can return an obfuscated "existing user" response instead of an error
    // when email enumeration protection is enabled. Do not treat that as a new account.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("هذا البريد الإلكتروني مسجّل بالفعل في Supabase. استخدم بريدًا آخر.");
    }

    return data;
  },
};
