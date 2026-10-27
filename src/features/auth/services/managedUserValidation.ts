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

const MANAGED_PERMISSION_KEYS = new Set([
  "orders",
  "orders_view",
  "orders_create_custom",
  "orders_cancel_modify",
  "orders_manage_carts",
  "orders_generate_qr",
  "pos",
  "pos_access",
  "pos_create_custom_order",
  "pos_apply_discounts",
  "pos_void_items",
  "restaurant_open_shift",
  "restaurant_returns",
  "captain",
  "captain_access",
  "captain_create_order",
  "captain_transfer_tables",
  "captain_modify_items",
  "kitchen",
  "kitchen_view",
  "kitchen_change_status",
  "kitchen_modify_order",
  "delivery",
  "delivery_view",
  "delivery_update_status",
  "inventory",
  "inventory_view",
  "inventory_adjust_transfer",
  "inventory_waste_dispose",
  "purchasing",
  "purchasing_view",
  "purchasing_add_invoice",
  "purchasing_returns",
  "production",
  "production_view",
  "production_execute",
  "hr",
  "hr_view_attendance",
  "hr_manage_payroll_loans",
  "treasury",
  "treasury_view",
  "treasury_open_close",
  "treasury_transfer_reconcile",
  "accounting",
  "accounting_view",
  "accounting_post_journal",
  "accounting_lock_period",
  "journal_approval",
  "expense_approval",
  "revenue_approval",
  "cost_centers",
  "mall_manage_shops",
  "mall_garden_finance",
  "reports",
  "reports_view_sales",
  "reports_view_financials",
  "super_admin_full_access",
  "users_roles",
  "system_manage_users",
  "branch_mgmt",
  "developer_options",
  "system_backup_update",
  "audit_logs",
  "system_audit_logs",
  "manage_park_shifts",
  "delete_park_shifts",
  "park_reports",
  "park_open_shift",
  "park_returns",
  "approval_journals",
  "approval_expenses",
  "approval_revenues",
]);

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
  hosted?: boolean;
  requireEmail?: boolean;
  requirePassword?: boolean;
  requirePasswordConfirmation?: boolean;
  existingUsers?: Array<{ id?: string; username?: string; email?: string }>;
  editingUserId?: string | null;
}

export interface ValidationRuleCheck {
  id: string;
  label: string;
  met: boolean;
}

export interface ManagedUserInspectionResult {
  fullNameChecks: ValidationRuleCheck[];
  usernameChecks: ValidationRuleCheck[];
  emailChecks: ValidationRuleCheck[];
  passwordChecks: ValidationRuleCheck[];
  isFullNameValid: boolean;
  isUsernameValid: boolean;
  isEmailValid: boolean;
  isPasswordValid: boolean;
  isValid: boolean;
  unmetSummary: string[];
}

export function inspectManagedUserConditions(
  input: ManagedUserFormInput,
): ManagedUserInspectionResult {
  const fullName = String(input.fullName ?? "").trim();
  const rawUsername = normalizeManagedDigits(String(input.username ?? "")).trim();
  const username = rawUsername.toLowerCase();
  const email = normalizeManagedEmail(input.email ?? "");
  const password = normalizeManagedDigits(String(input.password ?? ""));
  const passwordConfirmation = normalizeManagedDigits(String(input.passwordConfirmation ?? ""));
  const requirePassword = Boolean(input.requirePassword || password.length > 0);
  const requireConfirmation = Boolean(
    input.requirePasswordConfirmation ?? requirePassword,
  );

  const otherUsers = (input.existingUsers || []).filter(
    (u) => !input.editingUserId || String(u.id) !== String(input.editingUserId),
  );

  const isUsernameDuplicate =
    username.length > 0 &&
    otherUsers.some(
      (u) => normalizeManagedUsername(u.username || "") === username,
    );

  const isEmailDuplicate =
    email.length > 0 &&
    otherUsers.some(
      (u) => normalizeManagedEmail(u.email || "") === email,
    );

  const fullNameChecks: ValidationRuleCheck[] = [
    {
      id: "fullname_required",
      label: "إدخال الاسم الكامل للمستخدم (بين 1 و120 حرفاً)",
      met: fullName.length >= 1 && fullName.length <= 120,
    },
  ];

  const usernameChecks: ValidationRuleCheck[] = [
    {
      id: "username_length",
      label: "طول اسم المستخدم بين 3 و32 حرفاً",
      met: username.length >= 3 && username.length <= 32,
    },
    {
      id: "username_chars",
      label: "أحرف إنجليزية صغيرة أو أرقام فقط (يُسمح بـ . _ - وبدون مسافات أو رمز @)",
      met:
        rawUsername.length > 0 &&
        /^[a-z0-9._-]+$/.test(username) &&
        rawUsername === username,
    },
    {
      id: "username_unique",
      label: "اسم المستخدم فريد وغير مكرر في قاعدة البيانات",
      met: username.length >= 3 && !isUsernameDuplicate,
    },
  ];

  const emailChecks: ValidationRuleCheck[] = [
    {
      id: "email_format",
      label: "صيغة بريد إلكتروني صحيحة (مثل user@restocash.com) بحد أقصى 254 حرفاً",
      met: EMAIL_PATTERN.test(email) && email.length <= 254,
    },
    {
      id: "email_unique",
      label: "البريد الإلكتروني فريد وغير مرتبط بمستخدم آخر",
      met: EMAIL_PATTERN.test(email) && !isEmailDuplicate,
    },
  ];

  const passwordChecks: ValidationRuleCheck[] = requirePassword
    ? [
        {
          id: "password_length",
          label: "طول الرقم السري لا يقل عن 8 خانات",
          met: password.length >= 8,
        },
        {
          id: "password_letters_numbers",
          label: "يحتوي على حروف إنجليزية وأرقام معاً لتوافق حماية قاعدة البيانات",
          met: /[A-Za-z]/.test(password) && /[0-9]/.test(password),
        },
        {
          id: "password_no_spaces",
          label: "خالٍ من المسافات الفارغة",
          met: password.length > 0 && !/\s/.test(password),
        },
        ...(requireConfirmation
          ? [
              {
                id: "password_match",
                label: "تطابق الرقم السري مع خانة تأكيد الرقم السري",
                met: password.length >= 8 && password === passwordConfirmation,
              },
            ]
          : []),
      ]
    : [];

  const isFullNameValid = fullNameChecks.every((c) => c.met);
  const isUsernameValid = usernameChecks.every((c) => c.met);
  const isEmailValid =
    input.requireEmail === false && !email
      ? true
      : emailChecks.every((c) => c.met);
  const isPasswordValid = passwordChecks.every((c) => c.met);

  const unmetSummary = [
    ...fullNameChecks.filter((c) => !c.met).map((c) => c.label),
    ...usernameChecks.filter((c) => !c.met).map((c) => c.label),
    ...(input.requireEmail === false && !email
      ? []
      : emailChecks.filter((c) => !c.met).map((c) => c.label)),
    ...passwordChecks.filter((c) => !c.met).map((c) => c.label),
  ];

  return {
    fullNameChecks,
    usernameChecks,
    emailChecks,
    passwordChecks,
    isFullNameValid,
    isUsernameValid,
    isEmailValid,
    isPasswordValid,
    isValid:
      isFullNameValid && isUsernameValid && isEmailValid && isPasswordValid,
    unmetSummary,
  };
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
  const rawUsername = normalizeManagedDigits(String(input.username ?? "")).trim();
  const username = normalizeManagedUsername(input.username);
  const email = normalizeManagedEmail(input.email ?? "");
  const phone = String(input.phone ?? "").trim();
  const password = normalizeManagedDigits(String(input.password ?? ""));
  const requireEmail =
    input.requireEmail !== undefined
      ? input.requireEmail !== false
      : input.hosted !== false;
  const requirePassword = Boolean(input.requirePassword || password.length > 0);

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

  if (requireEmail || email.length > 0) {
    if (!EMAIL_PATTERN.test(email)) {
      throw new Error("أدخل بريدًا إلكترونيًا صحيحًا وصالحًا متوافقًا مع قاعدة البيانات (مثل name@restocash.com).");
    }
    if (email.length > 254) {
      throw new Error("البريد الإلكتروني لا يمكن أن يتجاوز 254 حرفًا.");
    }
  }

  if (input.existingUsers && input.existingUsers.length > 0) {
    const otherUsers = input.existingUsers.filter(
      (u) => !input.editingUserId || String(u.id) !== String(input.editingUserId),
    );
    if (otherUsers.some((u) => normalizeManagedUsername(u.username || "") === username)) {
      throw new Error("اسم المستخدم مستخدم بالفعل لمستخدم آخر. اختر اسم مستخدم فريدًا.");
    }
    if (
      email &&
      otherUsers.some((u) => normalizeManagedEmail(u.email || "") === email)
    ) {
      throw new Error("البريد الإلكتروني مرتبط بمستخدم آخر بالفعل. استخدم بريدًا مختلفًا.");
    }
  }

  if (requirePassword) {
    if (password.length < 8) {
      throw new Error(
        "كلمة المرور (الرقم السري) يجب ألا تقل عن 8 أحرف لتتوافق مع شروط قاعدة البيانات.",
      );
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new Error(
        "الرقم السري يجب أن يحتوي على حروف إنجليزية وأرقام معاً (مثل Admin@12345).",
      );
    }
    if (/\s/.test(password)) {
      throw new Error("الرقم السري لا يجب أن يحتوي على مسافات فارغة.");
    }
  }

  if (
    input.requirePasswordConfirmation &&
    requirePassword &&
    password !== normalizeManagedDigits(String(input.passwordConfirmation ?? ""))
  ) {
    throw new Error("تأكيد كلمة المرور (الرقم السري) غير مطابق للرقم السري الجديد.");
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
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  permissions?: unknown;
}): void {
  const id = String(profile.id ?? "").trim();
  if (!id) throw new Error("معرّف حساب Supabase مطلوب.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("معرّف الحساب غير صالح؛ يجب أن يكون UUID صادرًا من Supabase Auth.");
  }

  validateManagedUserForm({
    fullName: String(profile.full_name ?? ""),
    username: String(profile.username ?? ""),
    email: profile.email ? String(profile.email) : undefined,
    phone: String(profile.phone ?? ""),
    role: String(profile.role ?? ""),
    hosted: false,
    requireEmail: Boolean(profile.email),
  });

  const permissions = profile.permissions ?? {};
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    throw new Error("الصلاحيات يجب أن تكون كائنًا يحتوي قيمًا منطقية فقط.");
  }
  for (const [key, value] of Object.entries(permissions as Record<string, unknown>)) {
    if (!MANAGED_PERMISSION_KEYS.has(key)) {
      throw new Error(`اسم الصلاحية غير معتمد في النظام: ${key}. حدّث التطبيق قبل حفظ هذه الصلاحية.`);
    }
    if (typeof value !== "boolean") {
      throw new Error("الصلاحيات غير صالحة: كل صلاحية يجب أن تحتوي قيمة true أو false.");
    }
  }
}

export function userValidationErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();

  if (
    message.includes("username_already_exists") ||
    message.includes("profiles_username_lower_uidx") ||
    (message.includes("duplicate key") && message.includes("username"))
  ) {
    return "اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.";
  }
  if (
    message.includes("email_already_exists") ||
    message.includes("profiles_email_lower_uidx")
  ) {
    return "البريد الإلكتروني مرتبط بحساب آخر. استخدم بريدًا مختلفًا.";
  }
  if (
    message.includes("already registered") ||
    message.includes("user already registered") ||
    message.includes("identities")
  ) {
    return "هذا البريد الإلكتروني مسجّل بالفعل في Supabase. استخدم بريدًا آخر.";
  }
  if (message.includes("initial_admin_setup_closed")) {
    return "تم إنشاء المدير الأول بالفعل أو توجد حسابات سابقة؛ سجّل الدخول بالحساب الموجود بدلًا من إعادة التسجيل الأولي.";
  }
  if (
    message.includes("not_authorized") ||
    message.includes("insufficient permission") ||
    message.includes("cannot grant permission") ||
    message.includes("only a super administrator")
  ) {
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
  if (message.includes("email_invalid") || message.includes("invalid_email")) {
    return "البريد الإلكتروني المرتبط بحساب Supabase غير صالح. صحّح البريد قبل حفظ الملف.";
  }
  if (message.includes("invalid_permission_key")) {
    return "تم رفض الحفظ لأن النموذج يحتوي على صلاحية غير معتمدة في النظام. حدّث التطبيق ثم أعد المحاولة.";
  }
  if (message.includes("invalid_permissions")) {
    return "صيغة الصلاحيات غير مطابقة لقاعدة البيانات. يجب أن تكون كائنًا، وكل قيمة فيه true أو false فقط.";
  }
  if (message.includes("user_id_invalid")) {
    return "معرّف المستخدم ليس UUID صالحًا من Supabase Auth؛ لم يتم الحفظ.";
  }
  if (message.includes("auth_user_not_found")) {
    return "لم يوجد حساب Auth مطابق في Supabase؛ لم يُحفظ ملف المستخدم.";
  }
  if (message.includes("cannot delete the account you are currently using")) {
    return "لا يمكن حذف الحساب الذي تستخدمه حاليًا. سجّل الدخول بحساب مدير آخر أولًا.";
  }
  if (message.includes("invalid_role")) {
    return "الدور الوظيفي غير معتمد في قاعدة البيانات. اختر دورًا من القائمة.";
  }
  if (
    message.includes("database error saving new user") ||
    message.includes("database error updating user")
  ) {
    return "رفضت قاعدة البيانات تسجيل الحساب أثناء التحقق النهائي. تأكد من صحة الاسم والبريد واسم المستخدم والدور. إذا كانت البيانات صحيحة، راجع Supabase Auth Logs لمعرفة السبب التفصيلي.";
  }
  if (message.includes("email address") && (message.includes("invalid") || message.includes("valid"))) {
    return "صيغة البريد الإلكتروني غير صحيحة. أدخل بريدًا صالحًا مثل name@example.com.";
  }
  if (message.includes("weak_password") || message.includes("password should") || message.includes("password is")) {
    return "رفض Supabase كلمة المرور. استخدم كلمة مرور أقوى تتوافق مع سياسة المشروع.";
  }

  return raw || "تعذر حفظ المستخدم. لم تعتمد الواجهة التغيير لأن قاعدة البيانات لم تؤكده.";
}
