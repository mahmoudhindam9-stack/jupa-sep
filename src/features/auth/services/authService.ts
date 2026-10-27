import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { Profile } from "@/shared/types";
import {
  normalizeManagedDigits,
  normalizeManagedEmail,
  normalizeManagedUsername,
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

    const { data, error } = await (supabase as any).rpc("upsert_managed_user_profile", {
      p_user_id: profile.id,
      p_username: normalizeManagedUsername(profile.username ?? ""),
      p_full_name: String(profile.full_name || "").trim(),
      p_phone: String(profile.phone || "").trim(),
      p_role: String(profile.role).trim().toLowerCase(),
      p_permissions: profile.permissions || {},
    });

    if (error) {
      throw new Error(userValidationErrorMessage(error), { cause: error });
    }
    if (!data || typeof data !== "object" || !data.id) {
      throw new Error("لم يؤكد Supabase حفظ ملف المستخدم. لم يتم اعتماد التغيير.");
    }
    return data as Profile;
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
    const validated = validateManagedUserForm({
      fullName: input.full_name,
      username: input.username,
      email: input.email,
      phone: input.phone || "",
      password: input.password,
      role: input.role,
      hosted: true,
      requirePassword: true,
    });

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
        p_permissions: input.permissions || {},
      },
    );

    if (!rpcError && rpcProfile && typeof rpcProfile === "object" && rpcProfile.id) {
      return { profile: rpcProfile as Profile, sessionConfirmed: true };
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

  async deleteUser(id: string): Promise<void> {
    if (!id?.trim()) throw new Error("User id is required.");
    const { data, error } = await (supabase as any).rpc("delete_managed_user", {
      target_user_id: id,
    });
    if (error) throw new Error(userValidationErrorMessage(error), { cause: error });
    if (data !== true) throw new Error("لم يؤكد Supabase حذف الحساب؛ لم يتم اعتماد العملية.");
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
        },
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
