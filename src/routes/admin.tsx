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
import { AppBreadcrumbBar } from "@/components/navigation/AppBreadcrumbBar";

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
      "orders",
      "pos",
      "captain",
      "kitchen",
      "delivery",
      "inventory",
      "purchasing",
      "production",
    ],
  },
  {
    to: "/admin/mall",
    label: "إدارة المول",
    icon: Building2,
    permissionKeys: ["mall_manage_shops"],
  },
  {
    to: "/admin/park",
    label: "إدارة الحديقة",
    icon: Trees,
    permissionKeys: [
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
    permissionKeys: ["accounting", "accounting_view", "treasury"],
  },
  {
    to: "/admin/hr",
    label: "الموارد البشرية والمستخدمين",
    icon: UserCheck,
    permissionKeys: [
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
    permissionKeys: ["inventory", "inventory_view", "purchasing", "purchasing_view"],
  },
  {
    to: "/admin/system-update",
    label: "خيارات المطور والرقابة",
    icon: Settings,
    permissionKeys: ["system_backup_update", "developer_options"],
  },
];

const ALL_PERMISSION_KEYS = [
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
  "restaurant_open_shift",
  "restaurant_returns",
  "park_open_shift",
  "park_returns",
];

function isHostedDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !host.endsWith(".localhost");
}

function defaultPermissionsForRole(role: string): Record<string, boolean> {
  const permissions = Object.fromEntries(ALL_PERMISSION_KEYS.map((key) => [key, false])) as Record<
    string,
    boolean
  >;
  if (role === "admin" || role === "super_admin") {
    ALL_PERMISSION_KEYS.forEach((key) => {
      permissions[key] = true;
    });
    return permissions;
  }
  const roleKeys: Record<string, string[]> = {
    manager: [
      "orders",
      "orders_view",
      "orders_create_custom",
      "orders_manage_carts",
      "orders_generate_qr",
      "inventory",
      "inventory_view",
      "purchasing",
      "purchasing_view",
      "production",
      "production_view",
      "accounting",
      "accounting_view",
      "journal_approval",
      "expense_approval",
      "revenue_approval",
      "cost_centers",
      "reports",
      "reports_view_sales",
      "reports_view_financials",
      "hr",
      "hr_view_attendance",
    ],
    cashier: [
      "orders",
      "orders_view",
      "orders_create_custom",
      "orders_manage_carts",
      "orders_generate_qr",
      "pos",
      "pos_access",
      "pos_apply_discounts",
      "treasury_view",
      "treasury_open_close",
      "delivery",
      "delivery_view",
      "delivery_update_status",
    ],
    captain: [
      "captain",
      "captain_access",
      "captain_create_order",
      "captain_transfer_tables",
      "captain_modify_items",
      "orders",
      "orders_view",
    ],
    kitchen: ["kitchen", "kitchen_view", "kitchen_change_status", "kitchen_modify_order"],
  };
  (roleKeys[role] || []).forEach((key) => {
    permissions[key] = true;
  });
  return permissions;
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
  const isUserAdmin =
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    user?.username?.toLowerCase() === "admin" ||
    user?.email?.toLowerCase().includes("admin") ||
    current.super_admin_full_access === true ||
    current.admin === true;

  if (isUserAdmin) {
    return defaultPermissionsForRole("super_admin");
  }
  if (user?.permissionsManaged) return current;
  const hasGranular = Object.keys(current).some(
    (key) => key.includes("_view") || key.endsWith("_access") || key.startsWith("system_"),
  );
  return Object.keys(current).length > 0 && hasGranular
    ? current
    : defaultPermissionsForRole(user?.role || "cashier");
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
  if (keys.length === 0) return true;
  if (
    !user ||
    user.role === "admin" ||
    user.role === "super_admin" ||
    user.username?.toLowerCase() === "admin" ||
    user.email?.toLowerCase().includes("admin") ||
    user.permissions?.super_admin_full_access === true ||
    user.permissions?.admin === true
  ) {
    return true; // Admin ALWAYS has access to all pages!
  }
  const permissions = permissionsForUser(user);
  return keys.some((key) => permissions[key] === true);
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

  useEffect(() => {
    let mounted = true;

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
        return storedName.includes("@") ? storedName === normalized : storedName === username;
      });

      const isRecordAdmin =
        username === "admin" ||
        normalized === "admin" ||
        normalized.includes("admin") ||
        localRecord?.role === "admin" ||
        localRecord?.role === "super_admin";

      if (!localRecord || typeof localRecord.password !== "string" || !localRecord.password) {
        if (isRecordAdmin) {
          return {
            email: storedUser,
            username: "admin",
            role: "admin",
            permissions: defaultPermissionsForRole("super_admin"),
            permissionsManaged: false,
          };
        }
        return null;
      }

      const role = isRecordAdmin ? "admin" : localRecord.role || "cashier";
      const permissions =
        role === "admin" || role === "super_admin"
          ? defaultPermissionsForRole("super_admin")
          : (localRecord.permissions && Object.keys(localRecord.permissions).length > 0
              ? localRecord.permissions
              : null) ||
            state.userPermissions?.[localRecord.username] ||
            state.userPermissions?.[role] ||
            {};

      return {
        email: storedUser,
        username: localRecord.username || username,
        role,
        permissions,
        permissionsManaged: false,
      };
    };

    const loadHostedProfile = async (session: any) => {
      if (!session?.user?.id) {
        if (mounted) {
          setUser(null);
          navigate({ to: "/login" });
        }
        return;
      }
      try {
        const profile: any = await authService.getProfile(session.user.id);
        if (!profile?.id || !profile?.username) {
          await supabase.auth.signOut().catch(() => undefined);
          if (mounted) {
            setUser(null);
            navigate({ to: "/login" });
          }
          return;
        }
        const activeUser = {
          email: session.user.email || profile.username,
          username: String(profile.username).toLowerCase(),
          role: String(profile.role || "cashier"),
          permissions: (profile.permissions || {}) as Record<string, any>,
          permissionsManaged: true,
        };
        if (!mounted) return;
        erpStore.updateUserPermission(activeUser.username, activeUser.permissions);
        erpStore.upsertUser({
          id: profile.id,
          full_name: profile.full_name || activeUser.username,
          username: activeUser.username,
          phone: profile.phone || "",
          role: activeUser.role,
          permissions: activeUser.permissions,
          created_at: profile.created_at || new Date().toISOString(),
        } as SystemUser);
        setUser(activeUser);
      } catch (error) {
        console.error("Hosted account profile check failed.", error);
        if (mounted) {
          setUser(null);
          navigate({ to: "/login" });
        }
      }
    };

    const checkAuth = async () => {
      const localUser =
        localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        if (isHostedDeployment() && session?.user?.id) {
          await loadHostedProfile(session);
        } else if (localUser) {
          const local = readLocalUser(localUser);
          if (local) setUser(local);
          else {
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
        console.error("Al-Mokhtar auth check failed:", error);
        if (!mounted) return;
        if (localUser) {
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

    void checkAuth();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user?.id && isHostedDeployment()) {
        void Promise.resolve().then(() => loadHostedProfile(session));
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
      authListener?.subscription?.unsubscribe();
    };
  }, [navigate]);

  const handleSignOut = async () => {
    localStorage.removeItem("restocash_auth_user");
    localStorage.removeItem("restocash_user_role");
    sessionStorage.removeItem("restocash_auth_user");
    sessionStorage.removeItem("restocash_user_role");
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    navigate({ to: "/login" });
  };

  if (authChecking) {
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

  if (!user) return null;

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

      {/* Top Navigation Header - Modern & Minimal (Clean Top Bar) */}
      <header className="shrink-0 z-30 bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Right side in RTL: Brand */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link to="/admin" className="flex items-center gap-2 shrink-0 group">
            <RestocashLogo size={24} />
            <div className="text-right">
              <span className="font-black text-sm tracking-tight text-foreground block group-hover:text-primary transition leading-none">
                Restocash ERP
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold leading-none">
                نظام الإدارة المتكامل
              </span>
            </div>
          </Link>
        </div>

        {/* Left side in RTL: Tools, User Profile & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <LanguageSwitcher compact />
            <CurrencySwitcher compact />
          </div>

          {/* System version badge if permitted */}
          {hasAnyPermission(user, ["system_backup_update", "developer_options"]) && (
            <Link
              to="/admin/system-update"
              className="hidden lg:inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-mono bg-muted/50 px-2 py-1 rounded-lg border border-border/60"
              title="تحديثات النظام"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />v
              {CURRENT_VERSION}
            </Link>
          )}

          {/* User profile & Logout */}
          <div className="flex items-center gap-2 bg-muted/60 border border-border/80 px-2.5 py-1 rounded-xl">
            <div className="text-right hidden sm:block max-w-[130px]">
              <p className="text-[11px] font-black text-foreground truncate leading-tight">
                {user?.email?.split("@")[0] || "المسؤول"}
              </p>
              <p className="text-[9px] text-muted-foreground font-semibold leading-tight">
                {user?.role || "مشرف"}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleSignOut}
              title="تسجيل الخروج"
            >
              <LogOut size={15} />
            </Button>
          </div>
        </div>
      </header>

      {/* Secondary Hierarchical Navigation Bar (Appears only inside sections/subsections) */}
      <AppBreadcrumbBar />

      {/* Main Content Area - Full width, no sidebar margins */}
      <main className="flex-1 w-full min-w-0 overflow-y-auto">
        <div className="px-4 sm:px-6 pb-8 pt-0 max-w-7xl mx-auto w-full">
          {(() => {
            const searchParams = new URLSearchParams(location.search);
            let required: string[] | undefined;
            if ((pathname === "/admin" || pathname === "/admin/") && searchParams.has("tab")) {
              required = nav.find(
                (item) => item.search && item.search.tab === searchParams.get("tab"),
              )?.permissionKeys || ["__no_access_to_unmapped_page__"];
            } else if (
              pathname === "/admin" ||
              pathname === "/admin/" ||
              pathname === "/admin/index"
            ) {
              required = nav[0].permissionKeys;
            } else if (
              pathname.startsWith("/admin/accounts") ||
              pathname.startsWith("/admin/ledger") ||
              pathname.startsWith("/admin/reports")
            ) {
              required = [
                "accounting",
                "accounting_view",
                "treasury",
                "treasury_view",
                "mall_garden_finance",
                "super_admin_full_access",
              ];
            } else if (pathname.startsWith("/admin/park")) {
              required = [
                "manage_park_shifts",
                "delete_park_shifts",
                "park_reports",
                "mall_garden_finance",
                "super_admin_full_access",
              ];
            } else if (pathname.startsWith("/admin/hr") || pathname.startsWith("/admin/users")) {
              required = ["hr", "users_roles", "system_manage_users"];
            } else if (
              pathname.startsWith("/admin/restaurant") ||
              pathname.startsWith("/admin/orders")
            ) {
              required = [
                "orders",
                "pos",
                "captain",
                "kitchen",
                "delivery",
                "inventory",
                "purchasing",
                "production",
              ];
            } else if (pathname.startsWith("/admin/menu")) {
              required = ["pos", "inventory", "orders"];
            } else if (pathname.startsWith("/admin/inventory")) {
              required = ["inventory", "inventory_view", "purchasing", "purchasing_view"];
            } else {
              required = nav.find((item) => item.to !== "/admin" && pathname.startsWith(item.to))
                ?.permissionKeys || ["__no_access_to_unmapped_page__"];
            }
            return hasAnyPermission(user, required) ? (
              children || <Outlet />
            ) : (
              <div
                role="alert"
                className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm"
              >
                <ShieldCheck size={34} className="mx-auto mb-3 text-primary" />
                <h2 className="text-xl font-black text-foreground">
                  ليس لديك صلاحية لفتح هذه الصفحة
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  تُحدد صلاحيات الوصول من صفحة المستخدمين. اطلب من مسؤول النظام تفعيل صلاحية القسم
                  لحسابك.
                </p>
                <Button className="mt-5" onClick={() => navigate({ to: "/admin" })}>
                  العودة إلى لوحة التحكم
                </Button>
              </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
