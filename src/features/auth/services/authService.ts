import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { Profile } from "@/shared/types";

const getSecondaryClient = () => {
  const DEFAULT_SUPABASE_URL = "https://myqtvbfibvgxkqwxvuru.supabase.co";
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
      ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
      : undefined) || "sb_publishable_srgqLn2ZvysGKh47yCQ0Kg_IW02yjDf";

  if (!key || key.startsWith("http://") || key.startsWith("https://")) {
    key = "sb_publishable_srgqLn2ZvysGKh47yCQ0Kg_IW02yjDf";
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

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

  async signIn(email: string, password: string) {
    const normalizedEmail = assertCredentials(email, password);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
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
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
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
    if (!profile?.id?.trim()) throw new Error("Profile id is required.");
    const { data, error } = await supabase
      .from("profiles")
      .upsert(profile as any)
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  },

  async deleteUser(id: string): Promise<void> {
    if (!id?.trim()) throw new Error("User id is required.");
    const { data, error } = await (supabase as any).rpc("delete_managed_user", {
      target_user_id: id,
    });
    if (error) throw error;
    if (data !== true) throw new Error("Account deletion was not confirmed by Supabase.");
  },

  async signUpNewUser(email: string, password: string, profileData: any) {
    const normalizedEmail = assertCredentials(email, password);
    const secondaryClient = getSecondaryClient();
    const { data, error } = await secondaryClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: profileData,
      },
    });
    if (error) throw error;

    // Supabase can return an obfuscated "existing user" response instead of an error
    // when email enumeration protection is enabled. Do not treat that as a new account.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("هذا البريد الإلكتروني مسجّل بالفعل في Supabase. استخدم بريدًا آخر.");
    }

    return data;
  },
};
