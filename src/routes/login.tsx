import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RestocashLogo } from "@/components/RestocashLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { erpStore, SystemUser } from "@/shared/services/erpStore";
import { authService } from "@/features/auth/services/authService";
import { resetLocalManagedUserDirectoryForBootstrap } from "@/features/auth/services/userDirectorySync";
import { useSettings } from "@/hooks/use-settings";
import { isAiStudioPreview } from "@/shared/services/previewAccess";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول" }] }),
  component: LoginRouteEntry,
});

// Helper to normalize eastern Arabic/Persian digits to western ASCII digits
function normalizeDigits(str: string): string {
  return str
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

function isHostedDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !host.endsWith(".localhost");
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
  // Hosted Supabase accounts always authenticate with their real Auth email.
  const candidates = normalized.includes("@") ? [normalized] : [];

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
        // An Auth identity without a managed profile is not an ERP account.
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
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (isAiStudioPreview()) {
      navigate({ to: "/admin", replace: true } as any);
      return;
    }
    setShowLogin(true);
  }, [navigate]);

  if (showLogin) return <LoginPage />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
      <div className="text-sm font-bold text-muted-foreground">جاري فتح لوحة التحكم...</div>
    </div>
  );
}

function LoginPage() {
  const { lang } = useSettings();
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
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
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setHasLocalAccounts(localLoginUsers().length > 0);

    if (!isHostedDeployment()) {
      setIsBootstrapChecked(true);
      return;
    }

    void authService
      .isInitialAdminSetupAvailable()
      .then((available) => {
        if (available) {
          resetLocalManagedUserDirectoryForBootstrap();
        }
        setBootstrapAvailable(available);
      })
      .catch((cause) => {
        console.error("Could not check the initial Supabase user directory.", cause);
        setBootstrapCheckFailed(true);
        setError(
          "تعذر التحقق من حالة حسابات Supabase. غالبًا لم يُطبّق ترحيل تهيئة المدير الأول على قاعدة البيانات؛ لن نفتح التسجيل من دون تحقق آمن من أن قاعدة الحسابات فارغة.",
        );
      })
      .finally(() => setIsBootstrapChecked(true));
  }, []);

  useEffect(() => {
    const redirectTo = safeInternalRedirect(
      new URLSearchParams(window.location.search).get("redirect"),
    );
    const hosted = isHostedDeployment();
    const storedLocalUser =
      localStorage.getItem("restocash_auth_user") || sessionStorage.getItem("restocash_auth_user");

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
      const storage =
        localStorage.getItem("remember_me") === "false" ? sessionStorage : localStorage;
      storage.setItem("restocash_auth_user", session.user.email || activeUsername);
      storage.setItem("restocash_user_role", profile.role || "cashier");
      erpStore.updateUserPermission(activeUsername, profile.permissions || {});
      erpStore.upsertUser({
        id: profile.id,
        full_name: profile.full_name || activeUsername,
        username: activeUsername,
        email: profile.email || session.user.email || "",
        phone: profile.phone || "",
        role: profile.role || "cashier",
        permissions: profile.permissions || {},
        created_at: profile.created_at || new Date().toISOString(),
      } as SystemUser);
      erpStore.setCurrentUser(activeUsername);
      navigate({ to: redirectTo as any });
      return true;
    };

    if (hosted) {
      void continueWithHostedSession().catch((cause) =>
        console.error("Hosted session restoration failed.", cause),
      );
      return;
    }

    if (storedLocalUser) {
      const active = storedLocalUser.trim().toLowerCase();
      const storedUsername = active.split("@")[0];
      const exists = localLoginUsers().some((user) => {
        const candidate = String(user.username || "")
          .trim()
          .toLowerCase();
        return candidate.includes("@") ? candidate === active : candidate === storedUsername;
      });
      if (exists) {
        navigate({ to: redirectTo as any });
        return;
      }
      localStorage.removeItem("restocash_auth_user");
      localStorage.removeItem("restocash_user_role");
      sessionStorage.removeItem("restocash_auth_user");
      sessionStorage.removeItem("restocash_user_role");
    }
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
    if (!fullName || !newUsername || newPassword.length < 8) {
      setError("أدخل الاسم واسم المستخدم وكلمة مرور لا تقل عن 8 أحرف أو أرقام.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("تأكيد كلمة المرور غير مطابق.");
      return;
    }
    if (newUsername.includes("@") || /\s/.test(newUsername)) {
      setError("استخدم اسم مستخدم بدون مسافات أو بريد إلكتروني.");
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
    localStorage.setItem("restocash_auth_user", `${newUsername}@restocash.local`);
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
      if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("أدخل الاسم الكامل وبريدًا إلكترونيًا حقيقيًا وصالحًا.");
      }
      if (!/^[a-z0-9._-]{3,32}$/.test(newUsername)) {
        throw new Error("اسم المستخدم يجب أن يكون من 3 إلى 32 حرفًا أو رقمًا، ويمكن استخدام النقطة والشرطة فقط.");
      }
      if (newPassword.length < 8) {
        throw new Error("كلمة المرور يجب ألا تقل عن 8 أحرف، وقد يفرض مشروع Supabase شروطًا إضافية.");
      }
      if (newPassword !== confirmation) {
        throw new Error("تأكيد كلمة المرور غير مطابق.");
      }

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
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (signUpError) throw signUpError;
      if (!data.user?.id) {
        throw new Error("لم تُرجع Supabase معرّف الحساب. لم يتم تأكيد إنشاء المدير الأول.");
      }

      setBootstrapAvailable(false);
      setBootstrapEmail("");
      setBootstrapPassword("");
      setBootstrapConfirm("");

      if (!data.session?.user?.id) {
        // Email confirmation may be enabled in Supabase. The database trigger creates
        // the first admin profile in the same transaction as the Auth account.
        setUsername(email);
        setNotice("تم تسجيل الحساب الأول. افتح رسالة التأكيد التي أُرسلت إلى بريدك، ثم سجّل الدخول باستخدام البريد نفسه.");
        return;
      }

      const profile = await authService.getProfile(data.session.user.id);
      if (
        !profile?.id ||
        profile.role !== "admin" ||
        profile.permissions?.super_admin_full_access !== true
      ) {
        await supabase.auth.signOut().catch(() => undefined);
        throw new Error("أنشأت Supabase حساب Auth، لكن لم يُنشأ ملف المدير الأول بصلاحياته. تحقق من تطبيق آخر ترحيل قاعدة بيانات.");
      }

      localStorage.setItem("remember_me", "true");
      localStorage.removeItem("restocash_auth_user");
      sessionStorage.removeItem("restocash_auth_user");
      localStorage.removeItem("restocash_user_role");
      sessionStorage.removeItem("restocash_user_role");
      localStorage.setItem("restocash_auth_user", email);
      localStorage.setItem("restocash_user_role", "admin");

      const activeUsername = String(profile.username || newUsername).trim().toLowerCase();
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
      setError(cause?.message || "تعذر إنشاء المدير الأول في Supabase.");
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

    try {
      // Hosted deployments must authenticate against Supabase; browser-local users are not valid credentials.
      const foundUser = isHostedDeployment()
        ? undefined
        : localLoginUsers().find((user) => {
            const storedUsername = String(user.username || "")
              .trim()
              .toLowerCase();
            const fullName = String(user.full_name || "")
              .trim()
              .toLowerCase();
            const phone = normalizeDigits(String(user.phone || "").trim());
            return (
              storedUsername === normalizedUsername ||
              (storedUsername.includes("@") &&
                storedUsername.split("@")[0] === normalizedUsername) ||
              (normalizedUsername.includes("@") &&
                storedUsername === normalizedUsername.split("@")[0]) ||
              `${storedUsername}@restocash.local` === normalizedUsername ||
              `${storedUsername}@restocash.com` === normalizedUsername ||
              `${storedUsername}@juba.com` === normalizedUsername ||
              ((storedUsername === "admin" || storedUsername === "mahmoudhindam9@gmail.com") &&
                (normalizedUsername === "admin" ||
                  normalizedUsername === "mahmoudhindam9@gmail.com")) ||
              (fullName && fullName === normalizedUsername) ||
              (phone && phone === normalizedUsername)
            );
          });

      const passwordMatches =
        !isHostedDeployment() &&
        !!foundUser &&
        (foundUser.password === password ||
          normalizeDigits(foundUser.password || "") === normalizedPassword);

      if (foundUser && passwordMatches) {
        const activeUsername = String(foundUser.username).trim().toLowerCase();
        const activeEmail = activeUsername.includes("@")
          ? activeUsername
          : `${activeUsername}@restocash.local`;
        localStorage.removeItem("restocash_auth_user");
        sessionStorage.removeItem("restocash_auth_user");
        localStorage.removeItem("restocash_user_role");
        sessionStorage.removeItem("restocash_user_role");
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem("restocash_auth_user", activeEmail);
        storage.setItem("restocash_user_role", foundUser.role || "cashier");
        const statePermissions = erpStore.getState().userPermissions;
        const permissions =
          foundUser.permissions ||
          statePermissions[activeUsername] ||
          statePermissions[foundUser.role] ||
          {};
        erpStore.updateUserPermission(activeUsername, permissions);
        erpStore.setCurrentUser(activeUsername);
        const role = String(foundUser.role || "cashier");
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

      if (isHostedDeployment()) {
        try {
          const authenticated = await signInHostedUser(normalizedUsername, normalizedPassword);
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
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem("restocash_auth_user", activeEmail);
            storage.setItem("restocash_user_role", String(profile.role || "cashier"));
            const permissions = profile.permissions || {};
            erpStore.updateUserPermission(activeUsername, permissions);
            erpStore.upsertUser({
              id: profile.id,
              full_name: profile.full_name || activeUsername,
              username: activeUsername,
              email: profile.email || session.user.email || "",
              phone: profile.phone || "",
              role: profile.role || "cashier",
              permissions,
              created_at: profile.created_at || new Date().toISOString(),
            } as SystemUser);
            erpStore.setCurrentUser(activeUsername);
            const role = String(profile.role || "cashier");
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
          console.warn("Hosted authentication failed:", hostedErr);
        }
      }

      setError(
        isHostedDeployment()
          ? "تعذر تسجيل الدخول بالحساب السحابي. تأكد من إنشاء حساب admin في Supabase وأن كلمة المرور مضبوطة في إعدادات المشروع، ثم حاول مرة أخرى."
          : "اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد من بيانات الدخول.",
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
          <h1 className="text-xl font-black text-foreground text-center">إعداد Supabase غير مكتمل</h1>
          <p role="alert" className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
            {error || "تعذر التحقق من حسابات الدخول."}
          </p>
          <p className="text-sm text-muted-foreground">
            لن نعرض نموذج إنشاء المدير قبل تأكيد حالة قاعدة البيانات من الخادم؛ هذا يمنع منح صلاحيات مدير بطريقة غير آمنة.
          </p>
          <a
            className="block w-full text-center rounded-lg border border-border p-3 font-bold text-primary hover:bg-muted"
            href="https://github.com/mahmoudhindam9-stack/jupa-sep/blob/main/supabase/migrations/20261012120000_reset_users_and_bootstrap_first_admin.sql"
            target="_blank"
            rel="noreferrer"
          >
            فتح ترحيل إعداد المدير الأول
          </a>
          <Button
            type="button"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            إعادة الفحص بعد تطبيق الترحيل
          </Button>
        </div>
      </div>
    );
  }

  if (isMounted && isHostedDeployment() && !isBootstrapChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="w-full max-w-md space-y-4 bg-card border border-border p-7 rounded-2xl text-center">
          <RestocashLogo size={48} />
          <p className="text-sm text-muted-foreground">جارٍ التحقق من وجود حسابات في Supabase…</p>
        </div>
      </div>
    );
  }

  if (
    isMounted &&
    ((isHostedDeployment() && bootstrapAvailable) ||
      (!isHostedDeployment() && !hasLocalAccounts))
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
          onSubmit={isHostedDeployment() ? createFirstHostedAdmin : createFirstLocalAdmin}
          className="w-full max-w-md space-y-5 bg-card border border-border p-7 rounded-2xl shadow-elegant"
        >
          <div className="text-center space-y-2">
            <RestocashLogo size={52} />
            <h1 className="text-2xl font-black text-foreground">تهيئة حساب المدير الأول</h1>
            <p className="text-sm text-muted-foreground">
              {isHostedDeployment()
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
          {isHostedDeployment() && (
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
            <Input
              required
              type="password"
              minLength={8}
              value={bootstrapPassword}
              onChange={(e) => setBootstrapPassword(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>تأكيد كلمة المرور</Label>
            <Input
              required
              type="password"
              minLength={8}
              value={bootstrapConfirm}
              onChange={(e) => setBootstrapConfirm(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
            />
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
              : isHostedDeployment()
                ? "إنشاء أول مدير في Supabase"
                : "إنشاء حساب المدير والمتابعة إلى إدارة المستخدمين"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background p-4 relative"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="absolute top-4 left-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-6 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="flex justify-center mb-2">
          <RestocashLogo size={32} />
        </div>
        <p className="text-sm text-muted-foreground text-center">تسجيل الدخول للإدارة</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{isHostedDeployment() ? "البريد الإلكتروني" : "اسم المستخدم"}</Label>
            <Input
              type={isHostedDeployment() ? "email" : "text"}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder={isHostedDeployment() ? "name@example.com" : "admin"}
              autoComplete={isHostedDeployment() ? "email" : "username"}
              dir={isHostedDeployment() ? "ltr" : undefined}
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label>كلمة المرور</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••"
              dir="ltr"
              className="text-right mt-1"
            />
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
            />
            <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
              تذكرني
            </Label>
          </div>

          {notice && (
            <p role="status" className="text-sm text-emerald-700 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 text-center">
              {notice}
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 text-center font-bold">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full h-10 font-bold text-sm" disabled={loading}>
            {loading ? "جاري الدخول…" : "دخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}
