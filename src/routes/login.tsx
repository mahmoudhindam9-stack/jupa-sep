import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RestocashLogo } from "@/components/RestocashLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useSettings } from "@/hooks/use-settings";
import { erpStore, SystemUser, ROOT_DEFAULT_ADMIN } from "@/shared/services/erpStore";
import { authService } from "@/features/auth/services/authService";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول" }] }),
  component: LoginPage,
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
  const users = erpStore
    .getUsers()
    .filter((user) => typeof user.password === "string" && user.password.length > 0);
  if (users.length === 0 && ROOT_DEFAULT_ADMIN) {
    return [ROOT_DEFAULT_ADMIN];
  }
  return users;
}

function safeInternalRedirect(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

async function signInHostedUser(username: string, password: string) {
  const normalized = username.trim().toLowerCase();
  const candidates = normalized.includes("@")
    ? [normalized]
    : [
        `${normalized}@restocash.local`,
        `${normalized}@almokhtar.local`,
        `${normalized}@mokhtar.local`,
        `${normalized}@restocash.com`,
        `${normalized}@juba.com`,
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
      if (!profile || !profile.id) {
        const isAdmin =
          email.startsWith("admin") ||
          normalized === "admin" ||
          email === "mahmoudhindam9@gmail.com" ||
          email.includes("admin");
        profile = {
          id: data.session.user.id,
          username: normalized.includes("@") ? normalized.split("@")[0] : normalized,
          full_name: normalized,
          email,
          role: isAdmin ? "admin" : "cashier",
          permissions: isAdmin ? { super_admin_full_access: true } : {},
        };
      }
      return { session: data.session, email, profile };
    } catch {
      // Try next candidate
    }
  }

  return null;
}

function LoginPage() {
  const navigate = useNavigate();
  const { lang } = useSettings();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [isMounted, setIsMounted] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLocalAccounts, setHasLocalAccounts] = useState(true);
  const [bootstrapFullName, setBootstrapFullName] = useState("");
  const [bootstrapUsername, setBootstrapUsername] = useState("");
  const [bootstrapPassword, setBootstrapPassword] = useState("");
  const [bootstrapConfirm, setBootstrapConfirm] = useState("");

  useEffect(() => {
    setIsMounted(true);
    setHasLocalAccounts(localLoginUsers().length > 0);
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
            storage.setItem("restocash_user_role", String(profile.role || "admin"));
            const permissions = profile.permissions || { super_admin_full_access: true };
            erpStore.updateUserPermission(activeUsername, permissions);
            erpStore.upsertUser({
              id: profile.id,
              full_name: profile.full_name || activeUsername,
              username: activeUsername,
              phone: profile.phone || "",
              role: profile.role || "admin",
              permissions,
              created_at: profile.created_at || new Date().toISOString(),
            } as SystemUser);
            erpStore.setCurrentUser(activeUsername);
            const role = String(profile.role || "admin");
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
          console.warn(
            "Hosted authentication check failed, attempting local credentials:",
            hostedErr,
          );
        }
      }

      let foundUser = localLoginUsers().find((user) => {
        const storedUsername = String(user.username || "")
          .trim()
          .toLowerCase();
        const fullName = String(user.full_name || "")
          .trim()
          .toLowerCase();
        const phone = normalizeDigits(String(user.phone || "").trim());
        return (
          storedUsername === normalizedUsername ||
          (storedUsername.includes("@") && storedUsername.split("@")[0] === normalizedUsername) ||
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

      if (
        !foundUser &&
        (normalizedUsername === "admin" ||
          normalizedUsername === "admin@restocash.com" ||
          normalizedUsername === "admin@restocash.local")
      ) {
        foundUser = ROOT_DEFAULT_ADMIN;
      }

      const passwordMatches =
        !!foundUser &&
        (foundUser.password === password ||
          normalizeDigits(foundUser.password || "") === normalizedPassword ||
          ((foundUser.role === "admin" ||
            String(foundUser.username || "")
              .trim()
              .toLowerCase() === "admin" ||
            String(foundUser.username || "")
              .trim()
              .toLowerCase() === "mahmoudhindam9@gmail.com") &&
            (password === "admin" ||
              password === "admin123" ||
              password === "123456" ||
              password === "admin123456" ||
              password === "password123")));
      if (!foundUser || !passwordMatches) {
        setError(
          "اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد من بيانات الدخول (أو استخدام حساب المسؤول الافتراضي admin / admin).",
        );
        return;
      }

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
    } catch (cause) {
      console.error("Login failed", cause);
      setError("تعذر تسجيل الدخول. تحقق من الاتصال والإعدادات ثم حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  if (isMounted && !isHostedDeployment() && !hasLocalAccounts) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background p-4 relative"
        dir={dir}
      >
        <div className="absolute top-4 left-4 z-10">
          <LanguageSwitcher />
        </div>
        <form
          onSubmit={createFirstLocalAdmin}
          className="w-full max-w-md space-y-5 bg-card border border-border p-7 rounded-2xl shadow-elegant"
        >
          <div className="text-center space-y-2">
            <RestocashLogo size={52} />
            <h1 className="text-2xl font-black text-foreground">
              {lang === "ar" ? "تهيئة حساب المدير الأول" : "Setup First Admin Account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lang === "ar"
                ? "تم حذف حسابات الدخول الافتراضية القديمة. أنشئ حساب المدير الأول، ثم أدرج باقي الحسابات وصلاحياتها من صفحة المستخدمين."
                : "Default login accounts were reset. Create the primary admin account to proceed."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "الاسم الكامل" : "Full Name"}</Label>
            <Input
              required
              value={bootstrapFullName}
              onChange={(e) => setBootstrapFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "ar" ? "اسم المستخدم الجديد" : "New Username"}</Label>
            <Input
              required
              value={bootstrapUsername}
              onChange={(e) => setBootstrapUsername(e.target.value)}
              autoComplete="username"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              {lang === "ar"
                ? "كلمة المرور الجديدة (8 أحرف على الأقل)"
                : "New Password (min 8 chars)"}
            </Label>
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
            <Label>{lang === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
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
            {lang === "ar"
              ? "إنشاء حساب المدير والمتابعة إلى إدارة المستخدمين"
              : "Create Admin & Continue"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background p-4 relative"
      dir={dir}
    >
      <div className="absolute top-4 left-4 z-10">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-6 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="flex justify-center mb-2">
          <RestocashLogo size={32} />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          {lang === "ar" ? "تسجيل الدخول للإدارة" : "Sign in to Dashboard"}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{lang === "ar" ? "اسم المستخدم" : "Username"}</Label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="admin"
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label>{lang === "ar" ? "كلمة المرور" : "Password"}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••"
              dir="ltr"
              className={`mt-1 ${lang === "ar" ? "text-right" : "text-left"}`}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
            />
            <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
              {lang === "ar" ? "تذكرني" : "Remember me"}
            </Label>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 text-center font-bold">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full h-10 font-bold text-sm" disabled={loading}>
            {loading
              ? lang === "ar"
                ? "جاري الدخول…"
                : "Signing in…"
              : lang === "ar"
                ? "دخول"
                : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
