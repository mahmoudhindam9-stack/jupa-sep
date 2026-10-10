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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/features/auth/services/authService";
import { erpStore, SystemUser } from "@/shared/services/erpStore";
import { Button } from "@/components/ui/button";
import { RestocashLogo } from "@/components/RestocashLogo";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CURRENT_VERSION } from "@/shared/config/version";
import { GitHubUpdateBanner } from "@/components/admin/GitHubUpdateBanner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة" }] }),
  component: () => <AdminLayout />,
});

const nav = [
  { to: "/admin", label: "الرئيسية", icon: LayoutDashboard, exact: true, permissionKeys: ["orders", "pos", "captain", "kitchen", "delivery", "inventory", "accounting", "treasury", "hr", "reports", "mall_manage_shops", "purchasing"] },
  { to: "/admin/restaurant", label: "إدارة المطعم (البرنامج الشامل)", icon: Store, permissionKeys: ["orders", "pos", "captain", "kitchen", "delivery", "inventory", "purchasing", "production"] },
  { to: "/admin/mall", label: "إدارة المول والحديقة", icon: Building2, permissionKeys: ["mall_manage_shops", "mall_garden_finance", "manage_park_shifts", "park_reports"] },
  { to: "/admin", search: { tab: "treasury" }, label: "إدارة الخزائن", icon: Wallet, permissionKeys: ["treasury", "treasury_view", "treasury_open_close", "treasury_transfer_reconcile"] },
  { to: "/admin/receipts", label: "تصميم وإدارة الإيصالات والسندات", icon: Receipt, permissionKeys: ["treasury", "accounting", "revenue_approval", "expense_approval"] },
  { to: "/admin/accounts", label: "إدارة الحسابات", icon: Landmark, permissionKeys: ["accounting", "accounting_view", "accounting_post_journal", "cost_centers"] },
  { to: "/admin/ledger", label: "حساب الأستاذ", icon: BookOpen, permissionKeys: ["accounting", "accounting_view"] },
  { to: "/admin/hr", label: "إدارة الموارد البشرية", icon: UserCheck, permissionKeys: ["hr", "hr_view_attendance", "hr_manage_payroll_loans"] },
  { to: "/admin/reports", label: "التقارير", icon: BarChart3, permissionKeys: ["reports", "reports_view_sales", "reports_view_financials", "park_reports"] },
  { to: "/admin/users", label: "المستخدمين", icon: Users, permissionKeys: ["users_roles", "system_manage_users"] },
  { to: "/admin/system-update", label: "خيارات المطور", icon: Settings, permissionKeys: ["system_backup_update", "developer_options"] },
];

const ALL_PERMISSION_KEYS = [
  "orders","orders_view","orders_create_custom","orders_cancel_modify","orders_manage_carts","orders_generate_qr",
  "pos","pos_access","pos_create_custom_order","pos_apply_discounts","pos_void_items",
  "captain","captain_access","captain_create_order","captain_transfer_tables","captain_modify_items",
  "kitchen","kitchen_view","kitchen_change_status","kitchen_modify_order",
  "delivery","delivery_view","delivery_update_status",
  "inventory","inventory_view","inventory_adjust_transfer","inventory_waste_dispose",
  "purchasing","purchasing_view","purchasing_add_invoice","purchasing_returns",
  "production","production_view","production_execute",
  "hr","hr_view_attendance","hr_manage_payroll_loans",
  "treasury","treasury_view","treasury_open_close","treasury_transfer_reconcile",
  "accounting","accounting_view","accounting_post_journal","accounting_lock_period",
  "journal_approval","expense_approval","revenue_approval","cost_centers",
  "mall_manage_shops","mall_garden_finance","reports","reports_view_sales","reports_view_financials",
  "super_admin_full_access","users_roles","system_manage_users","branch_mgmt","developer_options",
  "system_backup_update","audit_logs","system_audit_logs","manage_park_shifts","delete_park_shifts","park_reports",
];

function isHostedDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !host.endsWith(".localhost");
}

function defaultPermissionsForRole(role: string): Record<string, boolean> {
  const permissions = Object.fromEntries(ALL_PERMISSION_KEYS.map((key) => [key, false])) as Record<string, boolean>;
  if (role === "admin" || role === "super_admin") {
    ALL_PERMISSION_KEYS.forEach((key) => { permissions[key] = true; });
    return permissions;
  }
  const roleKeys: Record<string, string[]> = {
    manager: [
      "orders","orders_view","orders_create_custom","orders_manage_carts","orders_generate_qr",
      "inventory","inventory_view","purchasing","purchasing_view","production","production_view",
      "accounting","accounting_view","journal_approval","expense_approval","revenue_approval","cost_centers",
      "reports","reports_view_sales","reports_view_financials","hr","hr_view_attendance",
    ],
    cashier: ["orders","orders_view","orders_create_custom","orders_manage_carts","orders_generate_qr","pos","pos_access","pos_apply_discounts","delivery","delivery_view","delivery_update_status"],
    captain: ["captain","captain_access","captain_create_order","captain_transfer_tables","captain_modify_items","orders","orders_view"],
    kitchen: ["kitchen","kitchen_view","kitchen_change_status","kitchen_modify_order"],
  };
  (roleKeys[role] || []).forEach((key) => { permissions[key] = true; });
  return permissions;
}

function permissionsForUser(user: { role?: string; permissions?: Record<string, any>; permissionsManaged?: boolean } | null): Record<string, boolean> {
  const current = user?.permissions || {};
  if (current.super_admin_full_access === true) return defaultPermissionsForRole("super_admin");
  if (user?.permissionsManaged) return current;
  const hasGranular = Object.keys(current).some((key) => key.includes("_view") || key.endsWith("_access") || key.startsWith("system_"));
  return Object.keys(current).length > 0 && hasGranular ? current : defaultPermissionsForRole(user?.role || "cashier");
}

function hasAnyPermission(user: { role?: string; permissions?: Record<string, any>; permissionsManaged?: boolean } | null, keys: string[] = []): boolean {
  if (keys.length === 0) return true;
  const permissions = permissionsForUser(user);
  return keys.some((key) => permissions[key] === true);
}

function localUsernameFromStorage(value: string): string {
  return String(value || "").split("@")[0].toLowerCase();
}

export function AdminLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [user, setUser] = useState<{ email?: string; username?: string; role?: string; permissions?: Record<string, any>; permissionsManaged?: boolean } | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const readLocalUser = (storedUser: string) => {
      const normalized = String(storedUser || "").trim().toLowerCase();
      const username = localUsernameFromStorage(normalized);
      const state: any = erpStore.getState();
      const localRecord = (state.users || []).find((item: any) => {
        const storedName = String(item.username || "").trim().toLowerCase();
        return storedName.includes("@") ? storedName === normalized : storedName === username;
      });
      if (!localRecord || typeof localRecord.password !== "string" || !localRecord.password) return null;
      const role = localRecord.role || "cashier";
      const permissions =
        (localRecord.permissions && Object.keys(localRecord.permissions).length > 0 ? localRecord.permissions : null) ||
        state.userPermissions?.[localRecord.username] ||
        state.userPermissions?.[role] ||
        {};
      return { email: storedUser, username: localRecord.username, role, permissions, permissionsManaged: false };
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (isHostedDeployment()) {
          if (session?.user?.id) await loadHostedProfile(session);
          else {
            setUser(null);
            navigate({ to: "/login" });
          }
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
        if (!isHostedDeployment() && localUser) {
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
      if (isHostedDeployment()) {
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

  const renderSidebarNav = (onItemClick?: () => void) => (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <RestocashLogo size={20} />
          <p className="text-[10px] text-muted-foreground mt-1">نظام الإدارة المتكامل</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          {location.pathname.startsWith("/admin") ? "لوحة التحكم الرئيسية" : "الإدارة"}
        </div>
        {nav.filter((item) => hasAnyPermission(user, item.permissionKeys)).map((item) => {
          const active = isNavItemActive(item);
          return (
            <Link
              key={item.to + (item.search ? "?" + new URLSearchParams(item.search).toString() : "")}
              to={item.to}
              search={item.search}
              onClick={() => {
                if (onItemClick) onItemClick();
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border space-y-2 shrink-0">
        <p className="px-3 text-xs text-muted-foreground truncate">{user?.email}</p>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => {
            if (onItemClick) onItemClick();
            handleSignOut();
          }}
        >
          <LogOut size={18} />
          تسجيل الخروج
        </Button>
        <Link
          to="/"
          onClick={() => {
            if (onItemClick) onItemClick();
          }}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition"
        >
          <ArrowLeft size={18} />
          الرئيسية
        </Link>

        <div className="pt-2 border-t border-border/60 space-y-2">
          <div className="space-y-1">
            <span className="px-1 text-[11px] font-bold text-muted-foreground block">
              لغة التطبيق:
            </span>
            <LanguageSwitcher compact />
          </div>
          <div className="space-y-1">
            <span className="px-1 text-[11px] font-bold text-muted-foreground block">
              عملة عرض اللوحة:
            </span>
            <CurrencySwitcher compact className="w-full justify-between" />
          </div>
        </div>

        {/* System Version & Update Status */}
        {hasAnyPermission(user, ["system_backup_update", "developer_options"]) && (
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <Link
              to="/admin/system-update"
              className="flex items-center gap-1.5 hover:text-foreground transition font-medium"
              title="انتقل إلى صفحة خيارات المطور والتحديثات"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>الإصدار: v{CURRENT_VERSION}</span>
            </Link>
            <span className="text-[10px] text-muted-foreground/70">GitHub Sync</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-l border-border bg-card flex-col h-screen sticky top-0">
        {renderSidebarNav()}
      </aside>

      {/* Mobile Drawer Navigation (Sheet) */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="right" className="w-[280px] p-0 border-l border-border bg-card">
          {renderSidebarNav(() => setIsMobileMenuOpen(false))}
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* GitHub Auto-Update Notification Banner */}
        <GitHubUpdateBanner />

        {/* Admin Header with Page Title, Mobile Toggle, and Currency/Language Switcher */}
        <header className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {/* Mobile Sidebar Toggle Icon Button */}
            <Button
              variant="outline"
              size="icon"
              className="md:hidden shrink-0 h-9 w-9 border-border"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="فتح القائمة الجانبية"
            >
              <Menu size={20} />
            </Button>
            <span className="font-black text-sm text-foreground">
              {activeNavItem?.label || "لوحة التحكم"}
            </span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              | نظام إدارة المطاعم والمحاسبة ERP
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <CurrencySwitcher />
          </div>
        </header>
        <div className="p-4 sm:p-6 flex-1">
          {(() => {
            const searchParams = new URLSearchParams(location.search);
            let required: string[] | undefined;
            if ((pathname === "/admin" || pathname === "/admin/") && searchParams.has("tab")) {
              required = nav.find((item) => item.search && item.search.tab === searchParams.get("tab"))?.permissionKeys
                || ["__no_access_to_unmapped_page__"];
            } else if (pathname === "/admin" || pathname === "/admin/" || pathname === "/admin/index") {
              required = nav[0].permissionKeys;
            } else if (pathname.startsWith("/admin/accounts") || pathname.startsWith("/admin/ledger")) {
              required = ["accounting", "accounting_view"];
            } else if (pathname.startsWith("/admin/restaurant") || pathname.startsWith("/admin/orders")) {
              required = ["orders", "pos", "captain", "kitchen", "delivery", "inventory", "purchasing", "production"];
            } else if (pathname.startsWith("/admin/menu")) {
              required = ["pos", "inventory", "orders"];
            } else if (pathname.startsWith("/admin/inventory")) {
              required = ["inventory", "inventory_view", "purchasing", "purchasing_view"];
            } else {
              required = nav.find((item) => item.to !== "/admin" && pathname.startsWith(item.to))?.permissionKeys
                || ["__no_access_to_unmapped_page__"];
            }
            return hasAnyPermission(user, required) ? (children || <Outlet />) : (
              <div role="alert" className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <ShieldCheck size={34} className="mx-auto mb-3 text-primary" />
                <h2 className="text-xl font-black text-foreground">ليس لديك صلاحية لفتح هذه الصفحة</h2>
                <p className="mt-2 text-sm text-muted-foreground">تُحدد صلاحيات الوصول من صفحة المستخدمين. اطلب من مسؤول النظام تفعيل صلاحية القسم لحسابك.</p>
                <Button className="mt-5" onClick={() => navigate({ to: "/admin" })}>العودة إلى لوحة التحكم</Button>
              </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
