import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RestocashLogo } from "@/components/RestocashLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { erpStore, SystemUser, ROOT_DEFAULT_ADMIN, type UserPermission } from "@/shared/services/erpStore";
import { authService } from "@/features/auth/services/authService";
import {
  normalizeManagedDigits,
  validateManagedUserForm,
  userValidationErrorMessage,
} from "@/features/auth/services/managedUserValidation";
import {
  resetLocalManagedUserDirectoryForBootstrap,
  syncUsersDirectoryWithDatabase,
} from "@/features/auth/services/userDirectorySync";
import { useSettings } from "@/hooks/use-settings";
import { isAiStudioPreview, isHostedDeployment } from "@/shared/services/previewAccess";
import {
  getDefaultPermissionsForRole,
  hasAnyEnabledPermission,
  notifyPermissionsUpdated,
} from "@/shared/services/userAuthorization";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول" }] }),
  component: LoginRouteEntry,
});

// Helper to normalize eastern Arabic/Persian digits to western ASCII digits
function normalizeDigits(str: string): string {
  return normalizeManagedDigits(str);
}


function localLoginUsers(): SystemUser[] {
  return erpStore
    .getUsers()
    .filter((user) => typeof user.username === "string" && user.username.trim().length > 0);
}

function safeInternalRedirect(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

async function signInHostedUser(username: string, password: string) {
  const normalized = username.trim().toLowerCase();
  const matchedLocalUser = localLoginUsers().find((u) => {
    const uName = String(u.username || "").trim().toLowerCase();
    const uEmail = String(u.email || "").trim().toLowerCase();
    return uName === normalized || (Boolean(uEmail) && uEmail === normalized);
  });

  const candidates = normalized.includes("@")
    ? [
        normalized,
        ...(normalized === "admin@juba.com" || normalized === "admin@restocash.local"
          ? ["admin@restocash.com"]
          : []),
      ]
    : [
        ...(matchedLocalUser?.email ? [matchedLocalUser.email.trim().toLowerCase()] : []),
        `${normalized}@restocash.com`,
        `${normalized}@juba.com`,
        `${normalized}@restocash.local`,
        ...(normalized === "admin" || normalized === "mahmoud.admin"
          ? ["admin@restocash.com", "admin@juba.com", "mahmoudhindam9@gmail.com"]
          : []),
      ];

  for (const email of Array.from(new Set(candidates))) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data?.session?.user?.id) continue;
      let profile: any = null;
      try {
        profile = await authService.getProfile(data.session.user.id);
      } catch (err) {
        console.warn("Could not load hosted user profile.", err);
      }
      if (!profile?.id || !profile?.username) {
        await supabase.auth.signOut().catch(() => undefined);
        return null;
      }
      return { session: data.session, email, profile };
    } catch {
      // Try next candidate
    }
  }

  return null;
}

function LoginRouteEntry() {
  return <LoginPage />;
}

function LoginPage() {
  const { lang } = useSettings();
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);
  const [username, setUsername] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("remember_me") !== "false"
      ? localStorage.getItem("restocash_saved_username") || ""
      : "";
  });
  const [password, setPassword] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("remember_me") !== "false"
      ? localStorage.getItem("restocash_saved_password") || ""
      : "";
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("remember_me") !== "false";
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLocalAccounts, setHasLocalAccounts] = useState(true);
  const [isBootstrapChecked, setIsBootstrapChecked] = useState(false);
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [bootstrapCheckFailed, setBootstrapCheckFailed] = useState(false);
  const [bootstrapFullName, setBootstrapFullName] = useState("");
  const [bootstrapUsername, setBootstrapUsername] = useState("");
  const [bootstrapEmail, setBootstrapEmail] = useState("");
  const [bootstrapPassword, setBootstrapPassword] = useState("");
  const [bootstrapConfirm, setBootstrapConfirm] = useState("");
  const [showBootstrapPassword, setShowBootstrapPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const savedRemember = localStorage.getItem("remember_me") !== "false";
    setRememberMe(savedRemember);
    if (savedRemember) {
      const savedUser = localStorage.getItem("restocash_saved_username");
      const savedPass = localStorage.getItem("restocash_saved_password");
      if (savedUser) setUsername(savedUser);
      if (savedPass) setPassword(savedPass);
    }

    const currentLocalUsers = localLoginUsers();
    setHasLocalAccounts(currentLocalUsers.length > 0);

    void syncUsersDirectoryWithDatabase().then(() => {
      setHasLocalAccounts(localLoginUsers().length > 0);
    });

    if (!isHostedDeployment() || currentLocalUsers.length > 0) {
      setIsBootstrapChecked(true);
      return;
    }

    void authService
      .isInitialAdminSetupAvailable()
      .then((available) => {
        setBootstrapAvailable(available);
      })
      .catch((cause) => {
        console.warn("Could not check initial Supabase user directory; falling back to local directory.", cause);
        setBootstrapCheckFailed(false);
      })
      .finally(() => setIsBootstrapChecked(true));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("logout") === "1") {
      localStorage.removeItem("restocash_auth_user");
      localStorage.removeItem("restocash_user_role");
      sessionStorage.removeItem("restocash_auth_user");
      sessionStorage.removeItem("restocash_user_role");
      erpStore.setCurrentUser("");
      void supabase.auth.signOut().catch(() => undefined);
      return;
    }

    const redirectTo = safeInternalRedirect(params.get("redirect"));
    const hosted = isHostedDeployment();
    const storedLocalUser =
      localStorage.getItem("restocash_auth_user") || sessionStorage.getItem("restocash_auth_user");
    const storedRole =
      localStorage.getItem("restocash_user_role") || sessionStorage.getItem("restocash_user_role");

    const checkStoredLocalSession = () => {
      if (!storedLocalUser) return false;
      const active = storedLocalUser.trim().toLowerCase();
      const storedUsername = active.split("@")[0];
      const matchedUser = localLoginUsers().find((user) => {
        const candidate = String(user.username || "")
          .trim()
          .toLowerCase();
        const candidateEmail = String(user.email || "")
          .trim()
          .toLowerCase();
        return (
          candidate === active ||
          candidate === storedUsername ||
          (Boolean(candidateEmail) && candidateEmail === active)
        );
      });
      const isAdmin =
        active === "admin" ||
        storedUsername === "admin" ||
        active.startsWith("admin@") ||
        active.includes("admin") ||
        storedRole === "admin" ||
        storedRole === "super_admin";
      if (matchedUser || isAdmin || Boolean(storedRole)) {
        const effectiveUsername = matchedUser
          ? String(matchedUser.username).trim().toLowerCase()
          : storedUsername;
        erpStore.setCurrentUser(effectiveUsername);
        navigate({ to: redirectTo as any });
        return true;
      }
      return false;
    };

    const continueWithHostedSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return false;
      const profile = await authService.getProfile(session.user.id);
      if (!profile?.id || !profile?.username) {
        await supabase.auth.signOut().catch(() => undefined);
        return false;
      }
      const activeUsername = String(profile.username).trim().toLowerCase();
      const activeRole = String(profile.role || "cashier").trim().toLowerCase();
      const customAdminPerms =
        hasAnyEnabledPermission(profile.permissions) ? profile.permissions : null;
      const resolvedPerms =
        activeRole === "admin" || activeRole === "super_admin" || activeUsername === "admin"
          ? (customAdminPerms
              ? { ...getDefaultPermissionsForRole("admin"), ...customAdminPerms, super_admin_full_access: true }
              : getDefaultPermissionsForRole("admin"))
          : hasAnyEnabledPermission(profile.permissions)
            ? profile.permissions
            : getDefaultPermissionsForRole(activeRole);
      const isRemembered = localStorage.getItem("remember_me") !== "false";
      if (isRemembered) {
        localStorage.setItem("restocash_auth_user", session.user.email || activeUsername);
        localStorage.setItem("restocash_user_role", activeRole);
      }
      sessionStorage.setItem("restocash_auth_user", session.user.email || activeUsername);
      sessionStorage.setItem("restocash_user_role", activeRole);
      erpStore.updateUserPermission(
        activeUsername,
        (resolvedPerms || {}) as Partial<UserPermission>,
      );
      erpStore.upsertUser({
        id: profile.id,
        full_name: profile.full_name || activeUsername,
        username: activeUsername,
        email: profile.email || session.user.email || "",
        phone: profile.phone || "",
        role: activeRole,
        permissions: (resolvedPerms || {}) as Partial<UserPermission>,
        created_at: profile.created_at || new Date().toISOString(),
      } as SystemUser);
      erpStore.setCurrentUser(activeUsername);
      navigate({ to: redirectTo as any });
      return true;
    };

    if (hosted) {
      const timeoutPromise = new Promise<boolean>((resolve) =>
        window.setTimeout(() => resolve(false), 1500),
      );
      void Promise.race([continueWithHostedSession(), timeoutPromise])
        .then((restored) => {
          if (!restored) {
            checkStoredLocalSession();
          }
        })
        .catch((cause) => {
          console.warn("Hosted session restoration failed, checking local session.", cause);
          checkStoredLocalSession();
        });
      return;
    }

    checkStoredLocalSession();
  }, [navigate]);

  useEffect(() => {
    return erpStore.subscribe(() => setHasLocalAccounts(localLoginUsers().length > 0));
  }, []);

  const createFirstLocalAdmin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isHostedDeployment()) return;
    if (localLoginUsers().length > 0) {
      setHasLocalAccounts(true);
      setError("توجد حسابات بالفعل في صفحة المستخدمين؛ سجّل الدخول بأحدها.");
      return;
    }

    const fullName = bootstrapFullName.trim();
    const newUsername = normalizeDigits(bootstrapUsername.trim().toLowerCase());
    const newPassword = normalizeDigits(bootstrapPassword);
    const confirmation = normalizeDigits(bootstrapConfirm);
    try {
      validateManagedUserForm({
        fullName,
        username: newUsername,
        password: newPassword,
        passwordConfirmation: confirmation,
        role: "admin",
        hosted: false,
        requirePassword: true,
        requirePasswordConfirmation: true,
      });
    } catch (validationError) {
      setError(userValidationErrorMessage(validationError));
      return;
    }

    const permissions = {
      super_admin_full_access: true,
      users_roles: true,
      system_manage_users: true,
      system_backup_update: true,
    };
    const firstUser: SystemUser = {
      id: `u-${Date.now()}`,
      full_name: fullName,
      username: newUsername,
      email: `${newUsername}@restocash.com`,
      phone: "",
      role: "admin",
      password: newPassword,
      permissions,
      created_at: new Date().toISOString(),
    };
    erpStore.upsertUser(firstUser);
    erpStore.updateUserPermission(newUsername, permissions);
    erpStore.setCurrentUser(newUsername);
    localStorage.setItem("remember_me", "true");
    localStorage.setItem("restocash_auth_user", `${newUsername}@restocash.com`);
    localStorage.setItem("restocash_user_role", "admin");
    setHasLocalAccounts(true);
    navigate({ to: "/admin/users" });
  };

  const createFirstHostedAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const fullName = bootstrapFullName.trim();
    const email = bootstrapEmail.trim().toLowerCase();
    const newUsername = normalizeDigits(bootstrapUsername.trim().toLowerCase());
    const newPassword = normalizeDigits(bootstrapPassword);
    const confirmation = normalizeDigits(bootstrapConfirm);

    try {
      validateManagedUserForm({
        fullName,
        username: newUsername,
        email,
        password: newPassword,
        passwordConfirmation: confirmation,
        role: "admin",
        hosted: true,
        requirePassword: true,
        requirePasswordConfirmation: true,
      });

      // Re-check at submit time. The database trigger also serializes first-user creation.
      if (!(await authService.isInitialAdminSetupAvailable())) {
        setBootstrapAvailable(false);
        throw new Error("تم إنشاء المدير الأول بالفعل. استخدم البريد وكلمة المرور لتسجيل الدخول.");
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: newPassword,
        options: {
          data: {
            username: newUsername,
            full_name: fullName,
            phone: "",
            role: "admin",
            bootstrap_first_admin: true,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (signUpError) throw signUpError;
      if (!data.user?.id) {
        throw new Error("لم تُرجع Supabase معرّف الحساب. لم يتم تأكيد إنشاء المدير الأول.");
      }
      if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error("هذا البريد الإلكتروني مسجّل بالفعل في Supabase. استخدم بريدًا آخر.");
      }

      setBootstrapAvailable(false);
      setBootstrapEmail("");
      setBootstrapPassword("");
      setBootstrapConfirm("");

      if (!data.session?.user?.id) {
        setUsername(email);
        setNotice(
          "تم تسجيل الحساب الأول. افتح رسالة التأكيد التي أُرسلت إلى بريدك، ثم سجّل الدخول باستخدام البريد نفسه.",
        );
        return;
      }

      const profile = await authService.getProfile(data.session.user.id);
      if (
        !profile?.id ||
        profile.role !== "admin" ||
        profile.permissions?.super_admin_full_access !== true
      ) {
        await supabase.auth.signOut().catch(() => undefined);
        throw new Error(
          "أنشأت Supabase حساب Auth، لكن لم يُنشأ ملف المدير الأول بصلاحياته. تحقق من تطبيق آخر ترحيل قاعدة بيانات.",
        );
      }

      localStorage.setItem("remember_me", "true");
      localStorage.removeItem("restocash_auth_user");
      sessionStorage.removeItem("restocash_auth_user");
      localStorage.removeItem("restocash_user_role");
      sessionStorage.removeItem("restocash_user_role");
      localStorage.setItem("restocash_auth_user", email);
      localStorage.setItem("restocash_user_role", "admin");

      const activeUsername = String(profile.username || newUsername)
        .trim()
        .toLowerCase();
      const permissions = profile.permissions || {};
      erpStore.updateUserPermission(activeUsername, permissions);
      erpStore.upsertUser({
        id: profile.id,
        full_name: profile.full_name || fullName,
        username: activeUsername,
        email,
        phone: profile.phone || "",
        role: profile.role,
        permissions,
        created_at: profile.created_at || new Date().toISOString(),
      } as SystemUser);
      erpStore.setCurrentUser(activeUsername);
      navigate({ to: "/admin/users" });
    } catch (cause: any) {
      setError(userValidationErrorMessage(cause) || "تعذر إنشاء المدير الأول في Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const normalizedUsername = normalizeDigits(username.trim().toLowerCase());
    const normalizedPassword = normalizeDigits(password);
    const destination = safeInternalRedirect(
      new URLSearchParams(window.location.search).get("redirect"),
    );
    localStorage.setItem("remember_me", rememberMe ? "true" : "false");

    const persistRememberedCredentials = () => {
      if (rememberMe) {
        localStorage.setItem("restocash_saved_username", username.trim());
        localStorage.setItem("restocash_saved_password", password);
      } else {
        localStorage.removeItem("restocash_saved_username");
        localStorage.removeItem("restocash_saved_password");
      }
    };

    try {
      // 1. Always attempt Supabase Auth + public.profiles login first on ANY host (with 2.5s timeout so local login is never blocked)
      try {
        const authenticated = await Promise.race([
          signInHostedUser(normalizedUsername, normalizedPassword),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2500)),
        ]);
        if (authenticated && "session" in authenticated && authenticated.session?.user?.id) {
          const { session, profile, email } = authenticated;
          const activeUsername = String(
            profile.username || normalizedUsername.split("@")[0] || "admin",
          )
            .trim()
            .toLowerCase();
          const activeEmail = session.user.email || email;
          localStorage.removeItem("restocash_auth_user");
          sessionStorage.removeItem("restocash_auth_user");
          localStorage.removeItem("restocash_user_role");
          sessionStorage.removeItem("restocash_user_role");
          const activeRole = String(profile.role || "cashier").trim().toLowerCase();
          if (rememberMe) {
            localStorage.setItem("restocash_auth_user", activeEmail);
            localStorage.setItem("restocash_user_role", activeRole);
          }
          sessionStorage.setItem("restocash_auth_user", activeEmail);
          sessionStorage.setItem("restocash_user_role", activeRole);
          persistRememberedCredentials();
          const customAdminPerms =
            hasAnyEnabledPermission(profile.permissions) ? profile.permissions : null;
          const permissions =
            activeRole === "admin" || activeRole === "super_admin" || activeUsername === "admin"
              ? (customAdminPerms
                  ? { ...getDefaultPermissionsForRole("admin"), ...customAdminPerms, super_admin_full_access: true }
                  : getDefaultPermissionsForRole("admin"))
              : hasAnyEnabledPermission(profile.permissions)
                ? profile.permissions
                : getDefaultPermissionsForRole(activeRole);
          erpStore.updateUserPermission(activeUsername, permissions);
          erpStore.upsertUser({
            id: profile.id,
            full_name: profile.full_name || activeUsername,
            username: activeUsername,
            email: profile.email || session.user.email || "",
            phone: profile.phone || "",
            role: activeRole,
            permissions,
            created_at: profile.created_at || new Date().toISOString(),
          } as SystemUser);
          erpStore.setCurrentUser(activeUsername);
          notifyPermissionsUpdated();
          const role = activeRole;
          const finalDestination = new URLSearchParams(window.location.search).has("redirect")
            ? destination
            : role === "captain"
              ? "/captain"
              : role === "kitchen"
                ? "/oven"
                : "/admin";
          navigate({ to: finalDestination as any });
          return;
        }
      } catch (hostedErr) {
        console.warn("Supabase authentication check did not match:", hostedErr);
      }

      // 2. Authenticate strictly against the Users Page directory (erpStore.getUsers())
      const directoryUsers = localLoginUsers();
      const inputBaseUsername = normalizedUsername.includes("@")
        ? normalizedUsername.split("@")[0]
        : normalizedUsername;
      const foundUser = directoryUsers.find((user) => {
        const storedUsername = String(user.username || "")
          .trim()
          .toLowerCase();
        const storedEmail = String(user.email || "")
          .trim()
          .toLowerCase();
        return (
          storedUsername === normalizedUsername ||
          storedUsername === inputBaseUsername ||
          (Boolean(storedEmail) && storedEmail === normalizedUsername) ||
          `${storedUsername}@restocash.com` === normalizedUsername ||
          `${storedUsername}@restocash.local` === normalizedUsername ||
          `${storedUsername}@juba.com` === normalizedUsername
        );
      });

      const storedPassword = String(foundUser?.password || "");
      const passwordMatches =
        Boolean(foundUser) &&
        Boolean(storedPassword) &&
        (storedPassword === password ||
          normalizeDigits(storedPassword) === normalizedPassword);

      if (foundUser && passwordMatches) {
        const activeUsername = String(foundUser.username).trim().toLowerCase();
        const activeRole = String(foundUser.role || "cashier").trim().toLowerCase();
        const activeEmail =
          foundUser.email ||
          (activeUsername.includes("@")
            ? activeUsername
            : `${activeUsername}@restocash.com`);
        localStorage.removeItem("restocash_auth_user");
        sessionStorage.removeItem("restocash_auth_user");
        localStorage.removeItem("restocash_user_role");
        sessionStorage.removeItem("restocash_user_role");
        if (rememberMe) {
          localStorage.setItem("restocash_auth_user", activeEmail);
          localStorage.setItem("restocash_user_role", activeRole);
        }
        sessionStorage.setItem("restocash_auth_user", activeEmail);
        sessionStorage.setItem("restocash_user_role", activeRole);
        persistRememberedCredentials();
        const statePermissions = erpStore.getState().userPermissions;
        const customAdminPerms =
          (hasAnyEnabledPermission(foundUser.permissions) ? foundUser.permissions : null) ||
          (hasAnyEnabledPermission(statePermissions?.[activeUsername])
            ? statePermissions[activeUsername]
            : null);
        const permissions =
          activeRole === "admin" || activeRole === "super_admin" || activeUsername === "admin"
            ? (customAdminPerms
                ? { ...getDefaultPermissionsForRole("admin"), ...customAdminPerms, super_admin_full_access: true }
                : getDefaultPermissionsForRole("admin"))
            : (hasAnyEnabledPermission(foundUser.permissions) ? foundUser.permissions : null) ||
              (hasAnyEnabledPermission(statePermissions?.[activeUsername])
                ? statePermissions[activeUsername]
                : null) ||
              (hasAnyEnabledPermission(statePermissions?.[activeRole])
                ? statePermissions[activeRole]
                : null) ||
              getDefaultPermissionsForRole(activeRole);
        erpStore.updateUserPermission(activeUsername, permissions);
        erpStore.setCurrentUser(activeUsername);
        notifyPermissionsUpdated();
        const role = activeRole;
        const finalDestination = new URLSearchParams(window.location.search).has("redirect")
          ? destination
          : role === "captain"
            ? "/captain"
            : role === "kitchen"
              ? "/oven"
              : "/admin";
        navigate({ to: finalDestination as any });
        return;
      }

      setError(
        "اسم المستخدم أو كلمة المرور غير صحيحة. تأكد من إدخال البيانات المسجلة في صفحة المستخدمين.",
      );
    } catch (cause) {
      console.error("Login failed", cause);
      setError("تعذر تسجيل الدخول. تحقق من الاتصال والإعدادات ثم حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  if (isMounted && isHostedDeployment() && isBootstrapChecked && bootstrapCheckFailed) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background p-4"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <div className="w-full max-w-lg space-y-5 bg-card border border-destructive/30 p-7 rounded-2xl shadow-sm">
          <div className="flex justify-center">
            <RestocashLogo size={48} />
          </div>
          <h1 className="text-xl font-black text-foreground text-center">
            إعداد Supabase غير مكتمل
          </h1>
          <p
            role="alert"
            className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20"
          >
            {error || "تعذر التحقق من حسابات الدخول."}
          </p>
          <p className="text-sm text-muted-foreground">
            لن نعرض نموذج إنشاء المدير قبل تأكيد حالة قاعدة البيانات من الخادم؛ هذا يمنع منح صلاحيات
            مدير بطريقة غير آمنة.
          </p>
          <a
            className="block w-full text-center rounded-lg border border-border p-3 font-bold text-primary hover:bg-muted"
            href="https://github.com/mahmoudhindam9-stack/jupa-sep/blob/main/supabase/migrations/20261012120000_reset_users_and_bootstrap_first_admin.sql"
            target="_blank"
            rel="noreferrer"
          >
            فتح ترحيل إعداد المدير الأول
          </a>
          <Button type="button" className="w-full" onClick={() => window.location.reload()}>
            إعادة الفحص بعد تطبيق الترحيل
          </Button>
        </div>
      </div>
    );
  }

  if (isMounted && isHostedDeployment() && !isBootstrapChecked) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background p-4"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <div className="w-full max-w-md space-y-4 bg-card border border-border p-7 rounded-2xl text-center">
          <RestocashLogo size={48} />
          <p className="text-sm text-muted-foreground">جارٍ التحقق من وجود حسابات في Supabase…</p>
        </div>
      </div>
    );
  }

  if (
    isMounted &&
    ((isHostedDeployment() && bootstrapAvailable) || (!isHostedDeployment() && !hasLocalAccounts))
  ) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background p-4 relative"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <div className="absolute top-4 left-4">
          <LanguageSwitcher />
        </div>
        <form
          onSubmit={isHostedDeployment(isMounted) ? createFirstHostedAdmin : createFirstLocalAdmin}
          className="w-full max-w-md space-y-5 bg-card border border-border p-7 rounded-2xl shadow-elegant"
        >
          <div className="text-center space-y-2">
            <RestocashLogo size={52} />
            <h1 className="text-2xl font-black text-foreground">تهيئة حساب المدير الأول</h1>
            <p className="text-sm text-muted-foreground">
              {isHostedDeployment(isMounted)
                ? "لم يتم العثور على أي مستخدم في Supabase. أنشئ حساب المدير الأول ببريد حقيقي، وسيُمنح صلاحيات الإدارة مرة واحدة فقط."
                : "تم حذف حسابات الدخول الافتراضية القديمة. أنشئ حساب المدير الأول، ثم أدرج باقي الحسابات وصلاحياتها من صفحة المستخدمين."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>الاسم الكامل</Label>
            <Input
              required
              value={bootstrapFullName}
              onChange={(e) => setBootstrapFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          {isHostedDeployment(isMounted) && (
            <div className="space-y-1.5">
              <Label>البريد الإلكتروني الحقيقي في Supabase</Label>
              <Input
                required
                type="email"
                value={bootstrapEmail}
                onChange={(e) => setBootstrapEmail(e.target.value)}
                autoComplete="email"
                placeholder="name@example.com"
                dir="ltr"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>اسم المستخدم داخل النظام</Label>
            <Input
              required
              value={bootstrapUsername}
              onChange={(e) => setBootstrapUsername(e.target.value)}
              autoComplete="username"
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9._-]{3,32}"
              placeholder="مثال: admin"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>كلمة المرور الجديدة (8 أحرف على الأقل، مع تطبيق سياسة Supabase)</Label>
            <div className="relative">
              <Input
                required
                type={showBootstrapPassword ? "text" : "password"}
                minLength={8}
                value={bootstrapPassword}
                onChange={(e) => setBootstrapPassword(e.target.value)}
                autoComplete="new-password"
                dir="ltr"
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setShowBootstrapPassword((prev) => !prev)}
                className="absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={showBootstrapPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                title={showBootstrapPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showBootstrapPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>تأكيد كلمة المرور</Label>
            <div className="relative">
              <Input
                required
                type={showBootstrapPassword ? "text" : "password"}
                minLength={8}
                value={bootstrapConfirm}
                onChange={(e) => setBootstrapConfirm(e.target.value)}
                autoComplete="new-password"
                dir="ltr"
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setShowBootstrapPassword((prev) => !prev)}
                className="absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={showBootstrapPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                title={showBootstrapPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showBootstrapPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20"
            >
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "جارٍ إنشاء حساب المدير…"
              : isHostedDeployment(isMounted)
                ? "إنشاء أول مدير في Supabase"
                : "إنشاء حساب المدير والمتابعة إلى إدارة المستخدمين"}
          </Button>
        </form>
      </div>
    );
  }

  const isEn = lang === "en";

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 relative overflow-hidden"
      dir={isEn ? "ltr" : "rtl"}
    >
      {/* Subtle architectural ambient glow */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="absolute top-4 left-4 right-4 flex items-center justify-between max-w-5xl mx-auto z-10">
        <RestocashLogo size={26} showDeveloper={false} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>

      <div className="w-full max-w-md relative z-10 bg-card border border-border p-7 sm:p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2 text-center">
          <div className="flex justify-center mb-3">
            <RestocashLogo size={36} showDeveloper={true} />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {isEn ? "Executive Portal Sign In" : "تسجيل الدخول للإدارة"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isEn
              ? "Enter your authorized credentials to access the ERP & POS suite"
              : "أدخل بيانات الحساب المعتمدة للوصول إلى منظومة الإدارة ونقاط البيع"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">
              {isEn ? "Username or Email Address" : "اسم المستخدم أو البريد الإلكتروني"}
            </Label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="admin / admin@restocash.com"
              autoComplete="username"
              dir="ltr"
              className="h-11 rounded-xl bg-muted/40 focus:bg-background font-mono text-sm"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">
              {isEn ? "Password" : "كلمة المرور"}
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                dir="ltr"
                className="h-11 rounded-xl bg-muted/40 focus:bg-background font-mono text-sm pl-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => {
                  const val = Boolean(checked);
                  setRememberMe(val);
                  localStorage.setItem("remember_me", val ? "true" : "false");
                  if (!val) {
                    localStorage.removeItem("restocash_saved_username");
                    localStorage.removeItem("restocash_saved_password");
                  }
                }}
              />
              <Label htmlFor="remember" className="text-xs font-semibold cursor-pointer">
                {isEn ? "Keep me signed in" : "تذكرني على هذا الجهاز"}
              </Label>
            </div>
          </div>

          {notice && (
            <p
              role="status"
              className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-center font-semibold"
            >
              {notice}
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20 text-center font-bold">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full h-11 rounded-xl font-extrabold text-sm shadow-sm cursor-pointer"
            disabled={loading}
          >
            {loading
              ? isEn
                ? "Signing in…"
                : "جاري الدخول…"
              : isEn
                ? "Sign In to Workspace"
                : "تسجيل الدخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}
