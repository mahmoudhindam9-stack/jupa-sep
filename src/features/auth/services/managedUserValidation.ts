const MANAGED_USER_ROLES = new Set([
  "admin",
  "super_admin",
  "manager",
  "cashier",
  "captain",
  "kitchen",
]);

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeManagedDigits(value: string): string {
  return String(value ?? "")
    .replace(/[٠۰]/g, "0")
    .replace(/[١۱]/g, "1")
    .replace(/[٢۲]/g, "2")
    .replace(/[٣۳]/g, "3")
    .replace(/[٤۴]/g, "4")
    .replace(/[٥۵]/g, "5")
    .replace(/[٦۶]/g, "6")
    .replace(/[٧۷]/g, "7")
    .replace(/[٨۸]/g, "8")
    .replace(/[٩۹]/g, "9");
}

export function normalizeManagedUsername(value: string): string {
  return normalizeManagedDigits(value).trim().toLowerCase();
}

export function normalizeManagedEmail(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

export interface ManagedUserFormInput {
  fullName: string;
  username: string;
  email?: string;
  phone?: string;
  password?: string;
  passwordConfirmation?: string;
  role: string;
  hosted: boolean;
  requirePassword?: boolean;
  requirePasswordConfirmation?: boolean;
}

export function validateManagedUserForm(input: ManagedUserFormInput): {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  role: string;
} {
  const fullName = String(input.fullName ?? "").trim();
  const username = normalizeManagedUsername(input.username);
  const email = normalizeManagedEmail(input.email ?? "");
  const phone = String(input.phone ?? "").trim();
  const password = normalizeManagedDigits(String(input.password ?? ""));

  if (!fullName) throw new Error("الاسم الكامل مطلوب.");
  if (fullName.length > 120) throw new Error("الاسم الكامل لا يمكن أن يتجاوز 120 حرفًا.");

  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      "اسم المستخدم يجب أن يتكون من 3 إلى 32 حرفًا إنجليزيًا صغيرًا أو رقمًا، ويسمح فقط بالنقطة والشرطة والشرطة السفلية.",
    );
  }

  if (!MANAGED_USER_ROLES.has(String(input.role ?? "").trim().toLowerCase())) {
    throw new Error("الدور الوظيفي غير صالح. اختر دورًا من القائمة المعتمدة.");
  }

  if (phone.length > 40) throw new Error("رقم الهاتف لا يمكن أن يتجاوز 40 حرفًا.");

  if (input.hosted && !EMAIL_PATTERN.test(email)) {
    throw new Error("أدخل بريدًا إلكترونيًا حقيقيًا وصالحًا لحساب Supabase.");
  }

  if (input.requirePassword && password.length < 8) {
    throw new Error(
      "كلمة المرور يجب ألا تقل عن 8 أحرف؛ وقد يرفضها Supabase إذا خالفت سياسة قوة كلمة المرور.",
    );
  }

  if (
    input.requirePasswordConfirmation &&
    password !== normalizeManagedDigits(String(input.passwordConfirmation ?? ""))
  ) {
    throw new Error("تأكيد كلمة المرور غير مطابق.");
  }

  return {
    fullName,
    username,
    email,
    phone,
    password,
    role: String(input.role).trim().toLowerCase(),
  };
}

export function validateManagedProfilePayload(profile: {
  id?: string;
  username?: string | null;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
  permissions?: unknown;
}): void {
  if (!String(profile.id ?? "").trim()) throw new Error("معرّف حساب Supabase مطلوب.");

  validateManagedUserForm({
    fullName: String(profile.full_name ?? ""),
    username: String(profile.username ?? ""),
    phone: String(profile.phone ?? ""),
    role: String(profile.role ?? ""),
    hosted: false,
  });

  const permissions = profile.permissions ?? {};
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    throw new Error("الصلاحيات يجب أن تكون كائنًا يحتوي قيمًا منطقية فقط.");
  }
  for (const [key, value] of Object.entries(permissions as Record<string, unknown>)) {
    if (!key.trim() || typeof value !== "boolean") {
      throw new Error("الصلاحيات غير صالحة: كل صلاحية يجب أن تحتوي قيمة true أو false.");
    }
  }
}

export function userValidationErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();

  if (message.includes("username_already_exists") || message.includes("profiles_username_lower_uidx") || message.includes("duplicate key") && message.includes("username")) {
    return "اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.";
  }
  if (message.includes("email_already_exists") || message.includes("profiles_email_lower_uidx")) {
    return "البريد الإلكتروني مرتبط بحساب آخر. استخدم بريدًا مختلفًا.";
  }
  if (message.includes("already registered") || message.includes("user already registered") || message.includes("identities")) {
    return "هذا البريد الإلكتروني مسجّل بالفعل في Supabase. استخدم بريدًا آخر.";
  }
  if (message.includes("not_authorized") || message.includes("insufficient permission") || message.includes("cannot grant permission") || message.includes("only a super administrator")) {
    return "تم رفض العملية: حسابك لا يملك صلاحية منح هذا الدور أو الصلاحيات المطلوبة.";
  }
  if (message.includes("invalid_username")) {
    return "اسم المستخدم غير صالح. استخدم 3–32 حرفًا إنجليزيًا صغيرًا أو رقمًا، مع النقطة أو الشرطة أو الشرطة السفلية فقط.";
  }
  if (message.includes("full_name_required") || message.includes("full_name_too_long")) {
    return "أدخل الاسم الكامل، ويجب ألا يتجاوز 120 حرفًا.";
  }
  if (message.includes("phone_too_long")) {
    return "رقم الهاتف لا يمكن أن يتجاوز 40 حرفًا.";
  }
  if (message.includes("invalid_email")) {
    return "البريد الإلكتروني غير صالح أو لا يتطابق مع حساب Supabase Auth.";
  }
  if (message.includes("cannot delete the account you are currently using")) {
    return "لا يمكن حذف الحساب الذي تستخدمه حاليًا. سجّل الدخول بحساب مدير آخر أولًا.";
  }
  if (message.includes("invalid_role")) {
    return "الدور الوظيفي غير معتمد في قاعدة البيانات. اختر دورًا من القائمة.";
  }
  if (message.includes("invalid_permissions")) {
    return "صيغة الصلاحيات غير مطابقة لقاعدة البيانات. يجب أن تكون كل صلاحية true أو false.";
  }
  if (message.includes("auth_user_not_found")) {
    return "لم يوجد حساب Auth مطابق في Supabase؛ لم يُحفظ ملف المستخدم.";
  }
  if (message.includes("weak_password") || message.includes("password should") || message.includes("password is")) {
    return "رفض Supabase كلمة المرور. استخدم كلمة مرور أطول وأقوى وتوافق مع سياسة المشروع.";
  }
  return raw || "تعذر حفظ المستخدم. لم تعتمد الواجهة التغيير لأن قاعدة البيانات لم تؤكده.";
}
