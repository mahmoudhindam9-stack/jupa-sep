import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RestocashLogo } from "@/components/RestocashLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSettings } from "@/hooks/use-settings";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/features/auth/services/authService";
import {
  DEFAULT_NEW_USER_PASSWORD,
  inspectPasswordResetConditions,
  isDefaultPlaceholderEmail,
  normalizeManagedDigits,
  userValidationErrorMessage,
} from "@/features/auth/services/managedUserValidation";
import {
  pushUsersDirectorySnapshotToSupabase,
  queueUserChange,
} from "@/features/auth/services/userDirectorySync";
import { erpStore, type SystemUser } from "@/shared/services/erpStore";
import { FORCE_PASSWORD_RESET_SESSION_KEY } from "./login";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "إعادة تعيين كلمة المرور — Restocash ERP" },
      {
        name: "description",
        content: "تعيين البريد الإلكتروني الشخصي وكلمة المرور وفق شروط الأمان المعتمدة للبرنامج وSupabase.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

interface PendingFirstLoginUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  redirect?: string;
}

function readFirstLoginContext(): PendingFirstLoginUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FORCE_PASSWORD_RESET_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.username === "string" && parsed.username.trim()) {
        return parsed as PendingFirstLoginUser;
      }
    }
  } catch {
    // ignore
  }

  const storedAuth =
    localStorage.getItem("restocash_auth_user") ||
    sessionStorage.getItem("restocash_auth_user") ||
    "";
  if (!storedAuth.trim()) return null;

  const active = storedAuth.trim().toLowerCase();
  const base = active.split("@")[0];
  const matched = erpStore.getUsers().find((u) => {
    const uname = String(u.username || "").trim().toLowerCase();
    const uemail = String(u.email || "").trim().toLowerCase();
    return uname === active || uname === base || (Boolean(uemail) && uemail === active);
  });

  if (
    matched &&
    (matched.must_change_password === true ||
      String(matched.password || "").trim().toLowerCase() ===
        DEFAULT_NEW_USER_PASSWORD.toLowerCase())
  ) {
    return {
      id: matched.id,
      username: String(matched.username).trim().toLowerCase(),
      email: matched.email || `${matched.username}@restocash.com`,
      fullName: matched.full_name || matched.username,
      role: matched.role || "cashier",
      redirect:
        matched.role === "captain"
          ? "/captain"
          : matched.role === "kitchen"
            ? "/oven"
            : "/admin",
    };
  }

  return null;
}

function ResetPasswordPage() {
  const { lang } = useSettings();
  const isEn = lang === "en";
  const navigate = useNavigate();

  const [checkingLink, setCheckingLink] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [resetMode, setResetMode] = useState<"recovery" | "first-login">("recovery");
  const [firstLoginUser, setFirstLoginUser] = useState<PendingFirstLoginUser | null>(null);
  const [targetAccountLabel, setTargetAccountLabel] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [personalEmail, setPersonalEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Resend recovery link state when link is expired or opened directly
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendNotice, setResendNotice] = useState("");

  const existingUsers = useMemo(() => erpStore.getUsers(), [recoveryReady, saving]);

  const inspection = useMemo(
    () =>
      inspectPasswordResetConditions(password, confirmPassword, {
        forbidDefaultPassword: true,
        personalEmail,
        requirePersonalEmail: true,
        existingUsers,
        currentUserId: firstLoginUser?.id || undefined,
        currentUsername: firstLoginUser?.username || undefined,
      }),
    [password, confirmPassword, personalEmail, existingUsers, firstLoginUser],
  );

  useEffect(() => {
    let active = true;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (session?.user?.id && !recoveryReady)) {
        const sessionEmail = String(session?.user?.email || "").trim().toLowerCase();
        setTargetAccountLabel(sessionEmail);
        if (sessionEmail && !isDefaultPlaceholderEmail(sessionEmail)) {
          setPersonalEmail((prev) => prev || sessionEmail);
        }
        setRecoveryReady(true);
        setCheckingLink(false);
        setError("");
      }
    });

    const establishRecoveryOrFirstLoginSession = async () => {
      try {
        const url = new URL(window.location.href);
        const query = url.searchParams;
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const modeParam = query.get("mode");

        // 1. Check if this is a mandatory First-Login Password Reset
        const pendingFirstLogin = readFirstLoginContext();
        if (
          (modeParam === "first-login" || Boolean(pendingFirstLogin)) &&
          !query.get("token_hash") &&
          !query.get("code") &&
          !hash.get("access_token")
        ) {
          if (pendingFirstLogin) {
            if (!active) return;
            setResetMode("first-login");
            setFirstLoginUser(pendingFirstLogin);
            setTargetAccountLabel(
              `${pendingFirstLogin.fullName} (${pendingFirstLogin.username})`,
            );
            if (
              pendingFirstLogin.email &&
              !isDefaultPlaceholderEmail(pendingFirstLogin.email)
            ) {
              setPersonalEmail(pendingFirstLogin.email);
            }
            setRecoveryReady(true);
            setCheckingLink(false);
            return;
          }
        }

        // 2. Otherwise check Supabase recovery URL parameters / session
        const urlError =
          query.get("error_description") ||
          query.get("error") ||
          hash.get("error_description") ||
          hash.get("error");

        if (urlError) {
          throw new Error(decodeURIComponent(urlError.replace(/\+/g, " ")));
        }

        const tokenHash = query.get("token_hash") || hash.get("token_hash");
        const code = query.get("code") || hash.get("code");
        const accessToken = hash.get("access_token") || query.get("access_token");
        const refreshToken = hash.get("refresh_token") || query.get("refresh_token");

        if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });
          if (verifyError) throw verifyError;
        }

        const initialSession = await supabase.auth.getSession();
        if (initialSession.error) throw initialSession.error;
        let session = initialSession.data.session;

        if (!session && code) {
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          session = data.session;
        }

        if (!session && accessToken && refreshToken) {
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) throw setSessionError;
          session = data.session;
        }

        if (!session?.user?.id) {
          // If no Supabase session, check again if there is a pending local first-login user
          if (pendingFirstLogin) {
            if (!active) return;
            setResetMode("first-login");
            setFirstLoginUser(pendingFirstLogin);
            setTargetAccountLabel(
              `${pendingFirstLogin.fullName} (${pendingFirstLogin.username})`,
            );
            if (
              pendingFirstLogin.email &&
              !isDefaultPlaceholderEmail(pendingFirstLogin.email)
            ) {
              setPersonalEmail(pendingFirstLogin.email);
            }
            setRecoveryReady(true);
            setCheckingLink(false);
            return;
          }

          throw new Error(
            isEn
              ? "The password reset link is invalid or has expired. Request a new recovery link below."
              : "رابط إعادة تعيين كلمة المرور غير صالح أو انتهت صلاحيته. يمكنك طلب رابط استعادة جديد بالأسفل.",
          );
        }

        if (!active) return;

        const isFirstLoginMeta =
          modeParam === "first-login" ||
          session.user.user_metadata?.must_change_password === true ||
          Boolean(pendingFirstLogin);

        setResetMode(isFirstLoginMeta ? "first-login" : "recovery");
        if (pendingFirstLogin) {
          setFirstLoginUser(pendingFirstLogin);
        }
        const candidateEmail =
          pendingFirstLogin?.email || session.user.email || "";
        if (candidateEmail && !isDefaultPlaceholderEmail(candidateEmail)) {
          setPersonalEmail(candidateEmail);
        }
        setTargetAccountLabel(
          pendingFirstLogin
            ? `${pendingFirstLogin.fullName} (${pendingFirstLogin.username})`
            : session.user.email ||
                String(session.user.user_metadata?.username || ""),
        );

        window.history.replaceState(
          {},
          document.title,
          isFirstLoginMeta ? "/reset-password?mode=first-login" : "/reset-password",
        );
        setRecoveryReady(true);
      } catch (cause: any) {
        if (!active) return;
        const message = String(cause?.message || "");
        const expired =
          /expired|otp_expired|invalid.*token|token.*invalid/i.test(message);
        setError(
          expired
            ? isEn
              ? "This recovery link has expired or has already been used. Please send a new link."
              : "انتهت صلاحية رابط الاستعادة أو تم استخدامه من قبل. يرجى إرسال رابط استعادة جديد."
            : message ||
                (isEn
                  ? "Could not verify the recovery link."
                  : "تعذر التحقق من رابط الاستعادة. اطلب رابطاً جديداً."),
        );
        setRecoveryReady(false);
      } finally {
        if (active) setCheckingLink(false);
      }
    };

    void establishRecoveryOrFirstLoginSession();
    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [isEn]);

  const saveNewPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const normalizedEmail = normalizeManagedDigits(personalEmail)
      .trim()
      .toLowerCase();
    const normalizedPassword = normalizeManagedDigits(password);
    const normalizedConfirm = normalizeManagedDigits(confirmPassword);
    const currentCheck = inspectPasswordResetConditions(
      normalizedPassword,
      normalizedConfirm,
      {
        forbidDefaultPassword: true,
        personalEmail: normalizedEmail,
        requirePersonalEmail: true,
        existingUsers: erpStore.getUsers(),
        currentUserId: firstLoginUser?.id || undefined,
        currentUsername: firstLoginUser?.username || undefined,
      },
    );

    if (!currentCheck.isValid) {
      setError(
        currentCheck.unmetSummary[0] ||
          (isEn
            ? "Please enter a valid personal email and fulfill all password requirements before saving."
            : "يرجى إدخال بريدك الإلكتروني الشخصي واستيفاء جميع شروط كلمة المرور قبل الحفظ."),
      );
      return;
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // 1. Update password & personal email in Supabase Auth & profiles when a session exists
      if (session?.user?.id) {
        await authService.completeOwnPasswordReset(
          normalizedPassword,
          normalizedEmail,
        );
      } else if (resetMode !== "first-login" || !firstLoginUser) {
        throw new Error(
          isEn
            ? "Recovery session expired. Please request a new reset link."
            : "انتهت جلسة إعادة التعيين. يرجى طلب رابط استعادة جديد.",
        );
      }

      // 2. Synchronize the updated personal email & password and clear must_change_password in erpStore
      const targetEmail = (
        session?.user?.email ||
        firstLoginUser?.email ||
        ""
      )
        .trim()
        .toLowerCase();
      const targetUsername = (
        firstLoginUser?.username ||
        String(session?.user?.user_metadata?.username || "") ||
        (targetEmail.includes("@") ? targetEmail.split("@")[0] : "")
      )
        .trim()
        .toLowerCase();

      const directoryUsers = erpStore.getUsers();
      const matchedLocalUser = directoryUsers.find((u) => {
        const uname = String(u.username || "").trim().toLowerCase();
        const uemail = String(u.email || "").trim().toLowerCase();
        return (
          (Boolean(targetUsername) && uname === targetUsername) ||
          (Boolean(targetEmail) && uemail === targetEmail) ||
          (Boolean(session?.user?.id) && String(u.id) === String(session?.user?.id)) ||
          (Boolean(firstLoginUser?.id) && String(u.id) === String(firstLoginUser?.id))
        );
      });

      if (matchedLocalUser) {
        const updatedUser: SystemUser = {
          ...matchedLocalUser,
          email: normalizedEmail,
          password: normalizedPassword,
          must_change_password: false,
          password_changed_at: nowIso,
        };
        erpStore.upsertUser(updatedUser);

        // Also update the linked HR employee's email if found
        const matchedEmp = (erpStore.getState().employees || []).find(
          (emp) =>
            (updatedUser.employee_code &&
              emp.employee_code === updatedUser.employee_code) ||
            emp.name.trim() === updatedUser.full_name.trim(),
        );
        if (matchedEmp) {
          erpStore.updateEmployee(matchedEmp.id, {
            email: normalizedEmail,
          });
        }

        // Queue profile email sync to Supabase
        await queueUserChange({
          kind: "upsert",
          userId: updatedUser.id,
          username: updatedUser.username,
          profile: {
            id: updatedUser.id,
            username: updatedUser.username,
            email: normalizedEmail,
            full_name: updatedUser.full_name,
            phone: updatedUser.phone,
            role: updatedUser.role,
            permissions: updatedUser.permissions,
          },
        }).catch(() => undefined);
      }

      const resolvedUsername = String(
        matchedLocalUser?.username || targetUsername || "",
      )
        .trim()
        .toLowerCase();

      if (resolvedUsername && typeof window !== "undefined") {
        localStorage.setItem(`restocash_pwd_changed_${resolvedUsername}`, "1");
      }

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(FORCE_PASSWORD_RESET_SESSION_KEY);
      }

      // Push updated directory snapshot immediately to Supabase
      await pushUsersDirectorySnapshotToSupabase().catch(() => undefined);

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

      // For email recovery links, sign out the one-time recovery session so the user signs in cleanly
      if (resetMode === "recovery") {
        await supabase.auth.signOut().catch(() => undefined);
      }
    } catch (cause: any) {
      setError(
        userValidationErrorMessage(cause) ||
          cause?.message ||
          (isEn
            ? "Could not update email and password. Please try again."
            : "تعذر تحديث البريد الإلكتروني وكلمة المرور. تأكد من استيفاء الشروط وحاول مرة أخرى."),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSendRecoveryEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResendNotice("");
    const email = resendEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError(
        isEn
          ? "Please enter a valid email address linked to the user account."
          : "أدخل البريد الإلكتروني الصحيح المسجل باسم المستخدم.",
      );
      return;
    }

    setResendLoading(true);
    try {
      await authService.sendSupabasePasswordResetEmail(email);
      setResendNotice(
        isEn
          ? "Password reset link sent via Supabase! Open the link in your email to return to this page."
          : "تم إرسال رابط إعادة تعيين كلمة المرور عبر Supabase إلى البريد الإلكتروني بنجاح. افتح الرسالة واضغط على الرابط للعودة إلى هذه الصفحة.",
      );
    } catch (cause: any) {
      setError(
        userValidationErrorMessage(cause) ||
          cause?.message ||
          (isEn
            ? "Failed to send recovery link."
            : "تعذر إرسال رابط الاستعادة عبر Supabase."),
      );
    } finally {
      setResendLoading(false);
    }
  };

  const handleCancelFirstLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("restocash_auth_user");
      localStorage.removeItem("restocash_user_role");
      sessionStorage.removeItem("restocash_auth_user");
      sessionStorage.removeItem("restocash_user_role");
      sessionStorage.removeItem(FORCE_PASSWORD_RESET_SESSION_KEY);
    }
    erpStore.setCurrentUser("");
    await supabase.auth.signOut().catch(() => undefined);
    navigate({ to: "/login" });
  };

  const strengthColorClass =
    password.length === 0
      ? "bg-muted"
      : inspection.strengthScore < 50
        ? "bg-destructive"
        : inspection.strengthScore < 75
          ? "bg-amber-500"
          : "bg-emerald-500";

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 relative overflow-hidden"
      dir={isEn ? "ltr" : "rtl"}
    >
      {/* Subtle architectural ambient glow matching login.tsx */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Top Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between max-w-5xl mx-auto z-10">
        <RestocashLogo size={26} showDeveloper={false} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>

      <section className="w-full max-w-lg relative z-10 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl space-y-6 my-12">
        {/* Header */}
        <div className="flex flex-col items-center gap-2.5 text-center">
          <RestocashLogo size={36} showDeveloper={true} />
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
              success
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                : resetMode === "first-login"
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  : "bg-primary/10 text-primary border-primary/25"
            }`}
          >
            {success ? (
              <ShieldCheck className="h-6 w-6" />
            ) : resetMode === "first-login" ? (
              <UserCheck className="h-6 w-6" />
            ) : (
              <KeyRound className="h-6 w-6" />
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-foreground">
            {success
              ? isEn
                ? "Email & Password Updated Successfully"
                : "تم تحديث البريد الإلكتروني وكلمة المرور بنجاح"
              : resetMode === "first-login"
                ? isEn
                  ? "First-Time Sign In — Set Email & Password"
                  : "تسجيل الدخول لأول مرة — تسجيل البريد وكلمة المرور"
                : isEn
                  ? "Reset Account Password"
                  : "إعادة تعيين كلمة المرور"}
          </h1>

          <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-md">
            {success
              ? resetMode === "first-login"
                ? isEn
                  ? "Your personal email and new password have been saved and synced with the database. You can now proceed to your workspace."
                  : "تم حفظ ومزامنة بريدك الإلكتروني الشخصي وكلمة المرور الجديدة مع قاعدة البيانات بنجاح. يمكنك الآن الدخول للبرنامج."
                : isEn
                  ? "Your email and password have been updated in the database. You can now sign in with your new credentials."
                  : "تم تحديث البريد الإلكتروني وكلمة المرور في قاعدة البيانات بنجاح. يمكنك الآن تسجيل الدخول."
              : resetMode === "first-login"
                ? isEn
                  ? "Please enter your personal email address and set a new strong password to activate your account and sync with the database."
                  : "يرجى إدخال بريدك الإلكتروني الشخصي وتعيين كلمة مرور جديدة خاصة بك مستوفية للشروط ليتم مزامنتها فوراً مع قاعدة البيانات."
                : isEn
                  ? "Confirm your personal email address and enter a new password that fulfills all security requirements."
                  : "أكد بريدك الإلكتروني الشخصي وأدخل كلمة المرور الجديدة مع الالتزام بجميع الشروط المطلوبة."}
          </p>

          {targetAccountLabel && !success && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-1.5 text-xs font-bold text-foreground">
              <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{isEn ? "Account:" : "الحساب:"}</span>
              <span className="font-mono text-primary" dir="ltr">
                {targetAccountLabel}
              </span>
            </div>
          )}
        </div>

        {checkingLink ? (
          <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-2">
            <p className="text-sm font-bold text-foreground">
              {isEn
                ? "Verifying password reset session…"
                : "جارٍ التحقق من جلسة إعادة تعيين كلمة المرور…"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isEn ? "Please wait a moment." : "يرجى الانتظار لحظات."}
            </p>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-1.5">
              <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                {isEn
                  ? "Email & password synced with database ✓"
                  : "تم استيفاء الشروط ومزامنة البريد وكلمة المرور مع قاعدة البيانات ✓"}
              </p>
              <p className="text-xs text-muted-foreground">
                {resetMode === "first-login"
                  ? isEn
                    ? "You will not be asked to change your password on future sign-ins."
                    : "لن تظهر لك هذه الشاشة مرة أخرى عند تسجيل الدخول القادم."
                  : isEn
                    ? "Use your new password the next time you sign in."
                    : "استخدم كلمة المرور الجديدة عند تسجيل الدخول الآن."}
              </p>
            </div>

            {resetMode === "first-login" && firstLoginUser ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  className="w-full h-11 rounded-xl font-extrabold"
                  onClick={() =>
                    navigate({
                      to: (firstLoginUser.redirect || "/admin") as any,
                    })
                  }
                >
                  {isEn ? "Continue to System" : "المتابعة إلى البرنامج الآن"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl font-bold"
                  onClick={() => navigate({ to: "/login" })}
                >
                  {isEn ? "Back to Sign In" : "العودة لصفحة تسجيل الدخول"}
                </Button>
              </div>
            ) : (
              <Button
                className="w-full h-11 rounded-xl font-extrabold"
                onClick={() => navigate({ to: "/login" })}
              >
                {isEn ? "Go to Sign In Page" : "الانتقال إلى صفحة تسجيل الدخول"}
              </Button>
            )}
          </div>
        ) : recoveryReady ? (
          <form onSubmit={saveNewPassword} className="space-y-4">
            {/* Personal Email Input */}
            <div className="space-y-1.5">
              <Label htmlFor="personal-email" className="text-xs sm:text-sm font-bold">
                {isEn ? "Personal Email Address *" : "البريد الإلكتروني الشخصي *"}
              </Label>
              <div className="relative">
                <Input
                  id="personal-email"
                  type="email"
                  value={personalEmail}
                  onChange={(event) => setPersonalEmail(event.target.value)}
                  autoComplete="email"
                  required
                  dir="ltr"
                  placeholder={isEn ? "name@gmail.com" : "أدخل بريدك الإلكتروني الحقيقي (مثال: name@gmail.com)"}
                  className="h-11 rounded-xl bg-muted/40 focus:bg-background font-mono text-sm pl-11"
                  autoFocus
                />
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
              </div>
            </div>

            {/* New Password Input */}
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs sm:text-sm font-bold">
                {isEn ? "New Password *" : "كلمة المرور الجديدة *"}
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  dir="ltr"
                  placeholder={isEn ? "Enter strong password" : "أدخل كلمة مرور قوية (حروف إنجليزية + أرقام)"}
                  className="h-11 rounded-xl bg-muted/40 focus:bg-background font-mono text-sm pl-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs sm:text-sm font-bold">
                {isEn ? "Confirm New Password *" : "تأكيد كلمة المرور الجديدة *"}
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  dir="ltr"
                  placeholder={isEn ? "Re-enter new password" : "أعد كتابة كلمة المرور الجديدة للتأكيد"}
                  className="h-11 rounded-xl bg-muted/40 focus:bg-background font-mono text-sm pl-11"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((value) => !value)}
                  className="absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label={showConfirm ? "إخفاء التأكيد" : "إظهار التأكيد"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password Strength Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground">
                  {isEn ? "Password Strength:" : "قوة كلمة المرور:"}
                </span>
                <span
                  className={`font-black ${
                    password.length === 0
                      ? "text-muted-foreground"
                      : inspection.strengthScore < 50
                        ? "text-destructive"
                        : inspection.strengthScore < 75
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {isEn ? inspection.strengthLabelEn : inspection.strengthLabelAr}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${strengthColorClass}`}
                  style={{ width: `${inspection.strengthScore}%` }}
                />
              </div>
            </div>

            {/* Mandatory Email & Password Instructions & Live Validation Checklist */}
            <div className="rounded-xl border border-border bg-muted/25 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-foreground">
                  {isEn
                    ? "Email & Password Requirements:"
                    : "شروط البريد الإلكتروني وكلمة المرور:"}
                </span>
                <span
                  className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${
                    inspection.isValid
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  }`}
                >
                  {inspection.isValid
                    ? isEn
                      ? "All Met ✓"
                      : "مستوفاة بالكامل ✓"
                    : isEn
                      ? "Required"
                      : "شروط إلزامية"}
                </span>
              </div>

              <ul className="space-y-1.5 text-xs">
                {inspection.checks.map((rule) => (
                  <li
                    key={rule.id}
                    className={`flex items-start gap-2 font-semibold transition-colors ${
                      rule.met
                        ? "text-emerald-600 dark:text-emerald-400"
                        : password.length > 0 || personalEmail.length > 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {rule.met ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    )}
                    <span>{isEn && rule.labelEn ? rule.labelEn : rule.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs font-bold text-destructive text-center"
              >
                {error}
              </p>
            )}

            <div className="space-y-2 pt-1">
              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-extrabold text-sm shadow-sm cursor-pointer"
                disabled={saving || !inspection.isValid}
              >
                {saving
                  ? isEn
                    ? "Syncing email & password…"
                    : "جارٍ حفظ ومزامنة البريد وكلمة المرور…"
                  : isEn
                    ? "Save & Sync Email & Password"
                    : "حفظ ومزامنة البريد الإلكتروني وكلمة المرور"}
              </Button>

              {resetMode === "first-login" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 rounded-xl text-xs font-bold gap-1.5"
                  onClick={handleCancelFirstLogin}
                  disabled={saving}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {isEn
                    ? "Sign Out & Return to Login"
                    : "تسجيل الخروج والعودة لصفحة الدخول"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 rounded-xl text-xs font-bold gap-1.5"
                  onClick={() => navigate({ to: "/login" })}
                  disabled={saving}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {isEn ? "Back to Sign In" : "العودة إلى تسجيل الدخول"}
                </Button>
              )}
            </div>
          </form>
        ) : (
          /* Fallback when user opens /reset-password directly to request a link */
          <div className="space-y-5">
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs font-bold text-destructive text-center"
              >
                {error}
              </p>
            )}

            <form
              onSubmit={handleSendRecoveryEmail}
              className="space-y-3.5 rounded-xl border border-border bg-muted/25 p-4"
            >
              <div className="space-y-1">
                <p className="text-sm font-black text-foreground flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>
                    {isEn
                      ? "Send Password Reset Link"
                      : "إرسال رابط إعادة تعيين كلمة المرور"}
                  </span>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reset-request-email" className="text-xs font-bold">
                  {isEn ? "Registered User Email" : "البريد الإلكتروني المسجل للمستخدم"}
                </Label>
                <Input
                  id="reset-request-email"
                  type="email"
                  required
                  dir="ltr"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="h-10 rounded-xl bg-background font-mono text-xs"
                />
              </div>

              {resendNotice && (
                <p
                  role="status"
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300"
                >
                  {resendNotice}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-10 rounded-xl font-extrabold text-xs"
                disabled={resendLoading}
              >
                {resendLoading
                  ? isEn
                    ? "Sending Reset Link…"
                    : "جارٍ إرسال رابط الاستعادة…"
                  : isEn
                    ? "Send Reset Link to Email"
                    : "إرسال رابط استعادة كلمة المرور للإيميل"}
              </Button>
            </form>

            <Button
              variant="outline"
              className="w-full h-10 rounded-xl font-bold text-xs"
              onClick={() => navigate({ to: "/login" })}
            >
              {isEn ? "Back to Sign In Page" : "العودة إلى صفحة تسجيل الدخول"}
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
