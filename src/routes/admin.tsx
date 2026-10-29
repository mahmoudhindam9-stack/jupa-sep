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

  if (hasAnyTrueValue(current) && current.super_admin_full_access === false) {
    return current as Record<string, boolean>;
  }

  if (
    current.super_admin_full_access === true ||
    normalizedRole === "admin" ||
    normalizedRole === "super_admin" ||
    normalizedUsername === "admin"
  ) {
    return defaultPermissionsForRole("super_admin");
  }

  if (hasAnyTrueValue(current)) {
    return current as Record<string, boolean>;
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
    const requiresSupabaseSession = false;

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

      if (!localRecord) {
        return null;
      }

      const role = String(localRecord.role || "cashier").trim().toLowerCase();
      const resolvedUsername = String(localRecord.username || username).toLowerCase();

      if (role === "admin" || role === "super_admin" || resolvedUsername === "admin") {
        return {
          email: localRecord.email || storedUser,
          username: resolvedUsername,
          role: "admin",
          permissions: defaultPermissionsForRole("admin"),
          permissionsManaged: true,
        };
      }

      const explicitPerms =
        (hasAnyTrueValue(localRecord.permissions) ? localRecord.permissions : null) ||
        (hasAnyTrueValue(state.userPermissions?.[localRecord.username])
          ? state.userPermissions[localRecord.username]
          : null) ||
        (hasAnyTrueValue(state.userPermissions?.[username])
          ? state.userPermissions[username]
          : null);

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
        const resolvedPermissions =
          activeRole === "admin" || activeRole === "super_admin" || activeUsername === "admin"
            ? defaultPermissionsForRole("admin")
            : hasAnyTrueValue(rawPerms)
              ? rawPerms
              : defaultPermissionsForRole(activeRole);

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
        if (mounted) setAuthChecking(false);
      }
    };

    // Hard safety timeout: auth checking must never block the UI for more than 1500ms
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setAuthChecking(false);
      }
    }, 1500);

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
          <p className="mt-4 text-sm font-bold text-foreground">جاري التحقق من جلسة الدخول…</p>
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

  const searchParams = new URLSearchParams(location.search);
  const hasRouteSearch = searchParams.has("tab");
  const isNavItemActive = (item: (typeof nav)[number]) => {
    if (item.search) {
      return pathname === item.to && searchParams.get("tab") === item.search.tab;
    }
    if (item.exact) {
      // Do not mark the base dashboard active while a tab-specific view is open.
      return pathname === item.to && !hasRouteSearch;
    }
    return pathname.startsWith(item.to);
  };
  const activeNavItem = nav.find(isNavItemActive);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* GitHub Auto-Update Notification Banner */}
      <GitHubUpdateBanner />

      {/* 1. Permanent Fixed Main Top Bar (Brand, Quick Departments, Language, Currency, Theme, User) */}
      <AppMainNavbar
        user={user}
        onSignOut={handleSignOut}
        hasDepartmentPermission={(dept) =>
          !dept.permissionKeys || hasAnyPermission(user, dept.permissionKeys)
        }
        showSystemVersionLink={hasAnyPermission(user, [
          "system_backup_update",
          "developer_options",
          "super_admin_full_access",
        ])}
      />

      {/* 2. Contextual Breadcrumb Bar (Appears ONLY inside sections/subsections, zero duplication) */}
      <AppBreadcrumbBar />

      {/* Main Content Area - Full width, no sidebar margins */}
      <main className="flex-1 w-full min-w-0 overflow-y-auto">
        <div className="px-4 sm:px-6 pb-8 pt-0 max-w-7xl mx-auto w-full">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}
