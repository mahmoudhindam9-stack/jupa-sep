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
import { PERMISSIONS_UPDATED_EVENT } from "@/shared/services/userAuthorization";

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
    permissionKeys: ["hr", "hr_view_attendance", "hr_manage_payroll_loans", "super_admin_full_access"],
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

  if (current.super_admin_full_access === true) {
    return defaultPermissionsForRole("super_admin");
  }

  if (user?.permissionsManaged || Object.keys(current).length > 0) {
    return current as Record<string, boolean>;
  }

  return defaultPermissionsForRole(user?.role || "cashier");
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
  if (permissions.super_admin_full_access === true) return true;
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

      const role = localRecord.role || "cashier";
      const explicitPerms =
        (localRecord.permissions && Object.keys(localRecord.permissions).length > 0
          ? localRecord.permissions
          : null) ||
        (state.userPermissions?.[localRecord.username] &&
        Object.keys(state.userPermissions[localRecord.username]).length > 0
          ? state.userPermissions[localRecord.username]
          : null) ||
        (state.userPermissions?.[username] && Object.keys(state.userPermissions[username]).length > 0
          ? state.userPermissions[username]
          : null);

      const permissions = explicitPerms || defaultPermissionsForRole(role);

      return {
        email: localRecord.email || storedUser,
        username: localRecord.username || username,
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
        const activeUser = {
          email: session.user.email || profile.email || profile.username,
          username: String(profile.username).toLowerCase(),
          role: String(profile.role || "cashier"),
          permissions: (profile.permissions || {}) as Record<string, any>,
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
          } else if (isAiStudioPreview()) {
            const fallback = readLocalUser("admin@restocash.local") || {
              email: "admin@restocash.local",
              username: "admin",
              role: "admin",
              permissions: defaultPermissionsForRole("admin"),
              permissionsManaged: true,
            };
            localStorage.setItem("restocash_auth_user", "admin@restocash.local");
            localStorage.setItem("restocash_user_role", fallback.role || "admin");
            setUser(fallback);
          } else {
            localStorage.removeItem("restocash_auth_user");
            localStorage.removeItem("restocash_user_role");
            sessionStorage.removeItem("restocash_auth_user");
            sessionStorage.removeItem("restocash_user_role");
            setUser(null);
            navigate({ to: "/login" });
          }
        } else if (isAiStudioPreview()) {
          const fallback = readLocalUser("admin@restocash.local") || {
            email: "admin@restocash.local",
            username: "admin",
            role: "admin",
            permissions: defaultPermissionsForRole("admin"),
            permissionsManaged: true,
          };
          localStorage.setItem("restocash_auth_user", "admin@restocash.local");
          localStorage.setItem("restocash_user_role", fallback.role || "admin");
          setUser(fallback);
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
        } else if (isAiStudioPreview()) {
          const fallback = readLocalUser("admin@restocash.local") || {
            email: "admin@restocash.local",
            username: "admin",
            role: "admin",
            permissions: defaultPermissionsForRole("admin"),
            permissionsManaged: true,
          };
          setUser(fallback);
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
        else if (isAiStudioPreview()) {
          const fallback = readLocalUser("admin@restocash.local") || {
            email: "admin@restocash.local",
            username: "admin",
            role: "admin",
            permissions: defaultPermissionsForRole("admin"),
            permissionsManaged: true,
          };
          localStorage.setItem("restocash_auth_user", "admin@restocash.local");
          localStorage.setItem("restocash_user_role", fallback.role || "admin");
          setUser(fallback);
        } else {
          setUser(null);
          navigate({ to: "/login" });
        }
      } else if (isAiStudioPreview()) {
        const fallback = readLocalUser("admin@restocash.local") || {
          email: "admin@restocash.local",
          username: "admin",
          role: "admin",
          permissions: defaultPermissionsForRole("admin"),
          permissionsManaged: true,
        };
        localStorage.setItem("restocash_auth_user", "admin@restocash.local");
        localStorage.setItem("restocash_user_role", fallback.role || "admin");
        setUser(fallback);
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
          {(() => {
            const searchParams = new URLSearchParams(location.search);
            const tab = searchParams.get("tab");
            let required: string[] | undefined;

            if ((pathname === "/admin" || pathname === "/admin/") && tab) {
              if (tab === "shift_audit") {
                required = [
                  "treasury",
                  "treasury_view",
                  "treasury_open_close",
                  "accounting",
                  "accounting_view",
                  "reports",
                  "manage_park_shifts",
                  "audit_logs",
                  "super_admin_full_access",
                ];
              } else if (tab === "audit_logs") {
                required = [
                  "audit_logs",
                  "system_audit_logs",
                  "super_admin_full_access",
                ];
              } else if (tab === "treasury" || tab === "vouchers" || tab === "accounts") {
                required = [
                  "treasury",
                  "treasury_view",
                  "accounting",
                  "accounting_view",
                  "super_admin_full_access",
                ];
              } else {
                required = nav[0].permissionKeys;
              }
            } else if (
              pathname === "/admin" ||
              pathname === "/admin/" ||
              pathname === "/admin/index"
            ) {
              required = [
                ...nav[0].permissionKeys,
                "users_roles",
                "system_manage_users",
                "audit_logs",
                "system_audit_logs",
                "developer_options",
                "system_backup_update",
                "manage_park_shifts",
                "mall_garden_finance",
                "super_admin_full_access",
              ];
            } else if (
              pathname.startsWith("/admin/accounts") ||
              pathname.startsWith("/admin/ledger") ||
              pathname.startsWith("/admin/reports") ||
              pathname.startsWith("/admin/receipts")
            ) {
              required = [
                "accounting",
                "accounting_view",
                "treasury",
                "treasury_view",
                "reports",
                "reports_view_sales",
                "reports_view_financials",
                "mall_garden_finance",
                "super_admin_full_access",
              ];
            } else if (pathname.startsWith("/admin/mall")) {
              required = [
                "mall_manage_shops",
                "mall_garden_finance",
                "accounting",
                "super_admin_full_access",
              ];
            } else if (pathname.startsWith("/admin/park")) {
              required = [
                "manage_park_shifts",
                "delete_park_shifts",
                "park_reports",
                "park_open_shift",
                "park_returns",
                "mall_garden_finance",
                "super_admin_full_access",
              ];
            } else if (pathname.startsWith("/admin/users")) {
              required = ["users_roles", "system_manage_users", "super_admin_full_access"];
            } else if (pathname.startsWith("/admin/hr")) {
              required = [
                "hr",
                "hr_view_attendance",
                "hr_manage_payroll_loans",
                "users_roles",
                "system_manage_users",
                "super_admin_full_access",
              ];
            } else if (
              pathname.startsWith("/admin/restaurant") ||
              pathname.startsWith("/admin/orders")
            ) {
              required = [
                "orders",
                "orders_view",
                "pos",
                "pos_access",
                "captain",
                "captain_access",
                "kitchen",
                "kitchen_view",
                "delivery",
                "delivery_view",
                "inventory",
                "purchasing",
                "production",
                "restaurant_open_shift",
                "restaurant_returns",
                "super_admin_full_access",
              ];
            } else if (pathname.startsWith("/admin/menu")) {
              required = ["pos", "pos_access", "inventory", "orders", "super_admin_full_access"];
            } else if (pathname.startsWith("/admin/inventory")) {
              required = [
                "inventory",
                "inventory_view",
                "inventory_adjust_transfer",
                "inventory_waste_dispose",
                "purchasing",
                "purchasing_view",
                "purchasing_add_invoice",
                "purchasing_returns",
                "super_admin_full_access",
              ];
            } else if (
              pathname.startsWith("/admin/system-update") ||
              pathname.startsWith("/admin/studio")
            ) {
              required = [
                "system_backup_update",
                "developer_options",
                "audit_logs",
                "system_audit_logs",
                "super_admin_full_access",
              ];
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
