// @ts-nocheck
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Grid3X3,
  ClipboardList,
  Package,
  BarChart3,
  Users,
  ArrowLeft,
  ArrowRight,
  LogOut,
  RefreshCw,
  Landmark,
  BookOpen,
  Wallet,
  UserCheck,
  Receipt,
  FileSpreadsheet,
  Menu,
  Utensils,
  Store,
  Building2,
  Settings,
  ShieldCheck,
  Trees,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/features/auth/services/authService";
import { erpStore, SystemUser } from "@/shared/services/erpStore";
import { Button } from "@/components/ui/button";
import { RestocashLogo } from "@/components/RestocashLogo";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CURRENT_VERSION } from "@/shared/config/version";
import { GitHubUpdateBanner } from "@/components/admin/GitHubUpdateBanner";
import { AppMainNavbar } from "@/components/navigation/AppMainNavbar";
import { AppBreadcrumbBar } from "@/components/navigation/AppBreadcrumbBar";
import { isAiStudioPreview, isHostedDeployment } from "@/shared/services/previewAccess";
import {
  PERMISSIONS_UPDATED_EVENT,
  getDefaultPermissionsForRole,
  hasAnyRequestedPermission,
  isDepartmentPermitted,
} from "@/shared/services/userAuthorization";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة" }] }),
  component: () => <AdminLayout />,
});

const nav = [
  {
    to: "/admin",
    label: "لوحة الأقسام الرئيسية",
    icon: LayoutDashboard,
    exact: true,
    permissionKeys: [
      "page_restaurant",
      "page_mall",
      "page_park",
      "page_finance",
      "page_hr",
      "page_inventory",
      "page_shift_audit",
      "page_audit_logs",
      "page_developer",
      "orders",
      "pos",
      "captain",
      "kitchen",
      "delivery",
      "inventory",
      "accounting",
      "treasury",
      "hr",
      "reports",
      "mall_manage_shops",
      "purchasing",
    ],
  },
  {
    to: "/admin/restaurant",
    label: "إدارة المطعم",
    icon: Store,
    permissionKeys: [
      "page_restaurant",
      "orders",
      "pos",
      "captain",
      "kitchen",
      "delivery",
      "restaurant_open_shift",
      "production",
    ],
  },
  {
    to: "/admin/mall",
    label: "إدارة المول",
    icon: Building2,
    permissionKeys: ["page_mall", "mall_manage_shops", "mall_garden_finance"],
  },
  {
    to: "/admin/park",
    label: "إدارة الحديقة",
    icon: Trees,
    permissionKeys: [
      "page_park",
      "manage_park_shifts",
      "delete_park_shifts",
      "park_reports",
      "mall_garden_finance",
    ],
  },
  {
    to: "/admin/ledger",
    label: "الإدارة المالية",
    icon: Landmark,
    permissionKeys: ["page_finance", "accounting", "accounting_view", "treasury", "reports"],
  },
  {
    to: "/admin/hr",
    label: "الموارد البشرية والمستخدمين",
    icon: UserCheck,
    permissionKeys: [
      "page_hr",
      "hr",
      "hr_view_attendance",
      "hr_manage_payroll_loans",
      "users_roles",
      "system_manage_users",
    ],
  },
  {
    to: "/admin/inventory",
    label: "المخزون والمستودعات",
    icon: Package,
    permissionKeys: [
      "page_inventory",
      "inventory",
      "inventory_view",
      "purchasing",
      "purchasing_view",
    ],
  },
  {
    to: "/admin",
    search: { tab: "shift_audit" },
    label: "تدقيق الورديات وسجل العمليات",
    icon: ShieldCheck,
    permissionKeys: [
      "page_shift_audit",
      "shift_audit",
      "manage_park_shifts",
      "restaurant_open_shift",
      "page_audit_logs",
      "audit_logs",
      "system_audit_logs",
      "super_admin_full_access",
    ],
  },
  {
    to: "/admin/system-update",
    label: "خيارات المطور والنسخ الاحتياطي",
    icon: Settings,
    permissionKeys: ["page_developer", "system_backup_update", "developer_options", "branch_mgmt"],
  },
];

function defaultPermissionsForRole(role: string): Record<string, boolean> {
  return getDefaultPermissionsForRole(role);
}

function hasAnyTrueValue(obj: Record<string, any> | null | undefined): boolean {
  if (!obj || typeof obj !== "object") return false;
  return Object.values(obj).some((v) => v === true);
}

function permissionsForUser(
  user: {
    email?: string;
    username?: string;
    role?: string;
    permissions?: Record<string, any>;
    permissionsManaged?: boolean;
  } | null,
): Record<string, boolean> {
  const current = user?.permissions || {};
  const normalizedRole = String(user?.role || "cashier").trim().toLowerCase();
  const normalizedUsername = String(user?.username || "").trim().toLowerCase();

  const isAdmin =
    normalizedRole === "admin" ||
    normalizedRole === "super_admin" ||
    normalizedUsername === "admin";

  if (hasAnyTrueValue(current)) {
    if (isAdmin || current.super_admin_full_access === true) {
      return {
        ...defaultPermissionsForRole("super_admin"),
        ...current,
        super_admin_full_access: true,
        users_roles: true,
        system_manage_users: true,
      };
    }
    return current as Record<string, boolean>;
  }

  if (isAdmin || current.super_admin_full_access === true) {
    return defaultPermissionsForRole("super_admin");
  }

  return defaultPermissionsForRole(normalizedRole);
}

function hasAnyPermission(
  user: {
    email?: string;
    username?: string;
    role?: string;
    permissions?: Record<string, any>;
    permissionsManaged?: boolean;
  } | null,
  keys: string[] = [],
): boolean {
  if (!user) return false;
  if (keys.length === 0) return true;

  const permissions = permissionsForUser(user);
  return hasAnyRequestedPermission(permissions, keys);
}

function localUsernameFromStorage(value: string): string {
  return String(value || "")
    .split("@")[0]
    .toLowerCase();
}

export function AdminLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [user, setUser] = useState<{
    email?: string;
    username?: string;
    role?: string;
    permissions?: Record<string, any>;
    permissionsManaged?: boolean;
  } | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    const requiresSupabaseSession = isHostedDeployment();

    const readLocalUser = (storedUser: string) => {
      const normalized = String(storedUser || "")
        .trim()
        .toLowerCase();
      const username = localUsernameFromStorage(normalized);
      const state: any = erpStore.getState();
      const localRecord = (state.users || []).find((item: any) => {
        const storedName = String(item.username || "")
          .trim()
          .toLowerCase();
        const storedEmail = String(item.email || "")
          .trim()
          .toLowerCase();
        return (
          (!!storedEmail && storedEmail === normalized) ||
          (storedName.includes("@") ? storedName === normalized : storedName === username)
        );
      });

      const explicitPerms =
        (localRecord && hasAnyTrueValue(localRecord.permissions) ? localRecord.permissions : null) ||
        (localRecord && hasAnyTrueValue(state.userPermissions?.[localRecord.username])
          ? state.userPermissions[localRecord.username]
          : null) ||
        (hasAnyTrueValue(state.userPermissions?.[username])
          ? state.userPermissions[username]
          : null) ||
        (hasAnyTrueValue(state.userPermissions?.[normalized])
          ? state.userPermissions[normalized]
          : null);

      if (!localRecord) {
        const isAdminUser =
          normalized === "admin" ||
          normalized.startsWith("admin@") ||
          username === "admin" ||
          (typeof window !== "undefined" &&
            (localStorage.getItem("restocash_user_role") === "admin" ||
              sessionStorage.getItem("restocash_user_role") === "admin"));

        if (isAdminUser) {
          const explicitAdminPerms =
            explicitPerms ||
            (hasAnyTrueValue(state.userPermissions?.["admin"]) ? state.userPermissions["admin"] : null);
          return {
            email: storedUser.includes("@") ? storedUser : "admin@restocash.com",
            username: username || "admin",
            role: "admin",
            permissions: explicitAdminPerms
              ? { ...defaultPermissionsForRole("admin"), ...explicitAdminPerms, super_admin_full_access: true }
              : defaultPermissionsForRole("admin"),
            permissionsManaged: true,
          };
        }
        return null;
      }

      const role = String(localRecord.role || "cashier").trim().toLowerCase();
      const resolvedUsername = String(localRecord.username || username).toLowerCase();

      if (role === "admin" || role === "super_admin" || resolvedUsername === "admin") {
        return {
          email: localRecord.email || storedUser,
          username: resolvedUsername,
          role: "admin",
          permissions: explicitPerms
            ? { ...defaultPermissionsForRole("admin"), ...explicitPerms, super_admin_full_access: true }
            : defaultPermissionsForRole("admin"),
          permissionsManaged: true,
        };
      }

      const permissions = explicitPerms || defaultPermissionsForRole(role);

      return {
        email: localRecord.email || storedUser,
        username: resolvedUsername,
        role,
        permissions,
        permissionsManaged: true,
      };
    };

    const loadHostedProfile = async (session: any): Promise<boolean> => {
      if (!session?.user?.id) {
        return false;
      }
      try {
        const profile: any = await authService.getProfile(session.user.id);
        if (!profile?.id || !profile?.username) {
          return false;
        }
        const activeUsername = String(profile.username).toLowerCase();
        const activeRole = String(profile.role || "cashier").toLowerCase();
        const rawPerms = (profile.permissions || {}) as Record<string, any>;
        const explicitPerms = hasAnyTrueValue(rawPerms)
          ? rawPerms
          : (hasAnyTrueValue(erpStore.getState().userPermissions?.[activeUsername])
              ? erpStore.getState().userPermissions[activeUsername]
              : null);

        const resolvedPermissions =
          activeRole === "admin" || activeRole === "super_admin" || activeUsername === "admin"
            ? (explicitPerms
                ? { ...defaultPermissionsForRole("admin"), ...explicitPerms, super_admin_full_access: true }
                : defaultPermissionsForRole("admin"))
            : (explicitPerms || defaultPermissionsForRole(activeRole));

        const activeUser = {
          email: session.user.email || profile.email || profile.username,
          username: activeUsername,
          role: activeRole,
          permissions: resolvedPermissions,
          permissionsManaged: true,
        };
        if (!mounted) return true;
        erpStore.updateUserPermission(activeUser.username, activeUser.permissions);
        erpStore.upsertUser({
          id: profile.id,
          full_name: profile.full_name || activeUser.username,
          username: activeUser.username,
          email: profile.email || session.user.email || "",
          phone: profile.phone || "",
          role: activeUser.role,
          permissions: activeUser.permissions,
          created_at: profile.created_at || new Date().toISOString(),
        } as SystemUser);
        setUser(activeUser);
        return true;
      } catch (error) {
        console.error("Hosted account profile check failed.", error);
        return false;
      }
    };

    const checkAuth = async () => {
      const localUser =
        localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user");
      try {
        // Safe timeout for Supabase getSession (max 1200ms)
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 1200)
        );
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        if (!mounted) return;

        // 1. Always prefer an active Supabase Auth session if present
        if (session?.user?.id) {
          const profilePromise = loadHostedProfile(session);
          const profileTimeout = new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), 1200)
          );
          const loaded = await Promise.race([profilePromise, profileTimeout]);
          if (loaded) return;
        }

        if (requiresSupabaseSession) {
          localStorage.removeItem("restocash_auth_user");
          localStorage.removeItem("restocash_user_role");
          sessionStorage.removeItem("restocash_auth_user");
          sessionStorage.removeItem("restocash_user_role");
          setUser(null);
          navigate({ to: "/login" });
        } else if (localUser) {
          const local = readLocalUser(localUser);
          if (local) {
            setUser(local);
          } else {
            localStorage.removeItem("restocash_auth_user");
            localStorage.removeItem("restocash_user_role");
            sessionStorage.removeItem("restocash_auth_user");
            sessionStorage.removeItem("restocash_user_role");
            setUser(null);
            navigate({ to: "/login" });
          }
        } else {
          setUser(null);
          navigate({ to: "/login" });
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        if (!mounted) return;
        if (!requiresSupabaseSession && localUser) {
          const local = readLocalUser(localUser);
          if (local) setUser(local);
          else {
            setUser(null);
            navigate({ to: "/login" });
          }
        } else {
          setUser(null);
          navigate({ to: "/login" });
        }
      } finally {
        const isStudioIframe =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("__studio_preview") === "1";
        if (!isStudioIframe) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        if (mounted) setAuthChecking(false);
      }
    };

    // Hard safety timeout: auth checking must never block the UI for more than 1800ms
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setAuthChecking(false);
      }
    }, 1800);

    void checkAuth();

    const refreshCurrentPermissions = () => {
      if (!mounted) return;
      const storedUser =
        localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user");
      if (storedUser) {
        const local = readLocalUser(storedUser);
        if (local) {
          setUser((prev) => {
            if (
              prev &&
              prev.username === local.username &&
              JSON.stringify(prev.permissions) === JSON.stringify(local.permissions)
            ) {
              return prev;
            }
            return local;
          });
        }
      }
    };

    const unsubscribeStore = erpStore.subscribe(refreshCurrentPermissions);
    window.addEventListener(PERMISSIONS_UPDATED_EVENT, refreshCurrentPermissions);

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user?.id) {
        void Promise.resolve().then(() => loadHostedProfile(session));
        return;
      }
      if (requiresSupabaseSession) {
        setUser(null);
        navigate({ to: "/login" });
        return;
      }
      const localUser =
        localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user");
      if (localUser) {
        const local = readLocalUser(localUser);
        if (local) setUser(local);
        else {
          setUser(null);
          navigate({ to: "/login" });
        }
      } else if (!session) {
        setUser(null);
        navigate({ to: "/login" });
      }
    });
    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      unsubscribeStore();
      window.removeEventListener(PERMISSIONS_UPDATED_EVENT, refreshCurrentPermissions);
      authListener?.subscription?.unsubscribe();
    };
  }, [navigate]);

  const handleSignOut = async () => {
    localStorage.removeItem("restocash_auth_user");
    localStorage.removeItem("restocash_user_role");
    sessionStorage.removeItem("restocash_auth_user");
    sessionStorage.removeItem("restocash_user_role");
    erpStore.setCurrentUser("");
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    navigate({ to: "/login" });
  };

  if (!isMounted || authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <RestocashLogo size={32} />
          <p className="mt-4 text-sm font-bold text-foreground">جاري التحقق من جلسة الدخول والصلاحيات…</p>
          <p className="mt-2 text-xs text-muted-foreground">يرجى الانتظار لحظات.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <RestocashLogo size={32} />
          <p className="mt-4 text-sm font-bold text-foreground">يرجى تسجيل الدخول للمتابعة</p>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition cursor-pointer"
          >
            الانتقال لتسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  const activeTabParam = extractTabParam(location.search, (location as any).searchStr);
  const hasRouteSearch = Boolean(activeTabParam);
  const isNavItemActive = (item: (typeof nav)[number]) => {
    if (item.search) {
      return pathname === item.to && activeTabParam === item.search.tab;
    }
    if (item.exact) {
      // Do not mark the base dashboard active while a tab-specific view is open.
      return pathname === item.to && !hasRouteSearch;
    }
    return pathname.startsWith(item.to);
  };
  const activeNavItem = nav.find(isNavItemActive);
  const isStudioRoute = pathname.startsWith("/admin/studio");

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* GitHub Auto-Update Notification Banner */}
      <GitHubUpdateBanner />

      {/* 1. Permanent Fixed Main Top Bar (Brand, Quick Departments, Language, Currency, Theme, User) */}
      <AppMainNavbar
        user={user}
        onSignOut={handleSignOut}
        hasDepartmentPermission={(dept) => isDepartmentPermitted(permissionsForUser(user), dept)}
        showSystemVersionLink={hasAnyPermission(user, [
          "system_backup_update",
          "developer_options",
          "super_admin_full_access",
        ])}
      />

      {/* 2. Contextual Breadcrumb & 3-Subsection Navigation Bar */}
      {!isStudioRoute && (
        <AppBreadcrumbBar
          hasDepartmentPermission={(dept) => isDepartmentPermitted(permissionsForUser(user), dept)}
        />
      )}

      {/* Main Content Area - Full-bleed edge-to-edge on Studio route, standard container on other admin pages */}
      <main
        className={
          isStudioRoute
            ? "flex-1 w-full min-w-0 min-h-0 overflow-hidden flex flex-col"
            : "flex-1 w-full min-w-0 overflow-y-auto"
        }
      >
        <div
          className={
            isStudioRoute
              ? "flex-1 w-full h-full min-h-0 p-0 max-w-none flex flex-col"
              : "px-4 sm:px-6 pb-8 pt-0 max-w-7xl mx-auto w-full"
          }
        >
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}
