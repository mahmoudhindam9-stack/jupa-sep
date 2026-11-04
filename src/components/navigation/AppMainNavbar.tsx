import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { BellRing, ChevronDown, Grid3X3, LogOut, ShieldCheck } from "lucide-react";
import { RestocashLogo } from "@/components/RestocashLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CURRENT_VERSION } from "@/shared/config/version";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import {
  getActiveUserPermissionsSync,
  isDepartmentPermitted,
  PERMISSIONS_UPDATED_EVENT,
  signOutCurrentUser,
} from "@/shared/services/userAuthorization";
import { erpStore } from "@/shared/services/erpStore";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import { useSettings } from "@/hooks/use-settings";
import {
  NAVIGATION_DEPARTMENTS,
  resolveNavigationState,
  isRestaurantScreenPath,
  dispatchSubTabCommand,
  type NavDepartment,
} from "./navigationRegistry";
import { cn } from "@/lib/utils";

export interface AppMainNavbarUser {
  email?: string;
  name?: string;
  role?: string;
  permissions?: Record<string, boolean> | string[];
}

export interface AppMainNavbarProps {
  user?: AppMainNavbarUser | null;
  onSignOut?: () => void | Promise<void>;
  hasDepartmentPermission?: (dept: NavDepartment) => boolean;
  showSystemVersionLink?: boolean;
  className?: string;
}

export function AppMainNavbar({
  user: propUser,
  onSignOut,
  hasDepartmentPermission,
  showSystemVersionLink = true,
  className,
}: AppMainNavbarProps) {
  const { lang } = useSettings();
  const isEn = lang === "en";
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fallbackUser, setFallbackUser] = useState<AppMainNavbarUser | null>(null);
  const [activePerms, setActivePerms] = useState<Record<string, boolean>>({
    super_admin_full_access: true,
  });
  const [pendingSelfOrdersCount, setPendingSelfOrdersCount] = useState<number>(0);
  const [hasUrgentTableCall, setHasUrgentTableCall] = useState<boolean>(false);
  const seenNavbarOrderIdsRef = useRef<Set<string>>(new Set());
  const initialPollDoneRef = useRef<boolean>(false);
  const wasRestaurantScreenRef = useRef<boolean>(false);

  const isRestaurantScreen = isRestaurantScreenPath(
    location.pathname,
    location.search,
    (location as { searchStr?: string }).searchStr,
  );

  useEffect(() => {
    if (!isRestaurantScreen) {
      setPendingSelfOrdersCount(0);
      setHasUrgentTableCall(false);
      if (wasRestaurantScreenRef.current) {
        sonnerToast.dismiss();
      }
      wasRestaurantScreenRef.current = false;
      return;
    }

    wasRestaurantScreenRef.current = true;
    let mounted = true;

    const getDismissedAssistanceIds = (): Set<string> => {
      try {
        const raw = localStorage.getItem("restocash_dismissed_assistance_ids_v1");
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed : []);
      } catch {
        return new Set();
      }
    };

    const checkPendingSelfOrders = async () => {
      if (!mounted || !isRestaurantScreenPath()) return;
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("id, status, notes, created_at")
          .in("status", ["pending_captain", "pending"])
          .or(
            "status.eq.pending_captain,notes.ilike.%[SELF_ORDER_PENDING_CAPTAIN]%,notes.ilike.%[TABLE_ASSISTANCE_CALL]%",
          )
          .order("created_at", { ascending: false })
          .limit(30);

        if (error || !mounted || !isRestaurantScreenPath()) return;
        const dismissedIds = getDismissedAssistanceIds();
        const rows = (data || []).filter((r) => {
          if (!r?.id) return false;
          if (dismissedIds.has(r.id)) return false;
          if (tableOrdersStore.shouldIgnoreRemoteOrder(r.id, r.created_at)) return false;
          const notes = String(r.notes || "");
          if (
            notes.includes("[CASHIER_PAID]") ||
            notes.includes("[CANCELLED_BY_CAPTAIN]") ||
            notes.includes("[SENT_TO_KITCHEN]") ||
            notes.includes("[SENT_TO_CASHIER]")
          ) {
            return false;
          }
          return true;
        });

        const calls = rows.filter((r) => String(r.notes || "").includes("[TABLE_ASSISTANCE_CALL]"));
        setPendingSelfOrdersCount(rows.length);
        setHasUrgentTableCall(calls.length > 0);

        if (!initialPollDoneRef.current) {
          rows.forEach((r) => seenNavbarOrderIdsRef.current.add(r.id));
          initialPollDoneRef.current = true;
          return;
        }

        const isCaptainPage = location.pathname.startsWith("/captain");
        for (const r of rows) {
          if (!seenNavbarOrderIdsRef.current.has(r.id)) {
            seenNavbarOrderIdsRef.current.add(r.id);
            if (!isCaptainPage && isRestaurantScreenPath()) {
              const isCall = String(r.notes || "").includes("[TABLE_ASSISTANCE_CALL]");
              toast({
                title: isCall
                  ? "🚨 استدعاء كابتن من طاولة عميل (QR)"
                  : "🔔 طلب ذاتي جديد من العميل (QR)",
                description: "افتح شاشة الكابتن لمراجعة الطلب وموقع الطاولة واعتماده للمطبخ.",
              });
            }
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    void checkPendingSelfOrders();
    const interval = setInterval(checkPendingSelfOrders, 4000);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("restocash_self_orders_bc");
        bc.onmessage = () => {
          if (isRestaurantScreenPath()) {
            void checkPendingSelfOrders();
          }
        };
      } catch {
        // Ignore BroadcastChannel error
      }
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      if (bc) {
        try {
          bc.close();
        } catch {
          // Ignore close error
        }
      }
    };
  }, [isRestaurantScreen, location.pathname, toast]);

  useEffect(() => {
    const refresh = () => {
      setActivePerms(getActiveUserPermissionsSync());
    };
    refresh();
    const unsub = erpStore.subscribe(refresh);
    window.addEventListener(PERMISSIONS_UPDATED_EVENT, refresh);
    return () => {
      unsub();
      window.removeEventListener(PERMISSIONS_UPDATED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (propUser) return;
    try {
      const raw =
        localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user");
      if (raw) {
        if (raw.startsWith("{")) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setFallbackUser(parsed);
            return;
          }
        } else {
          const role =
            localStorage.getItem("restocash_user_role") ||
            sessionStorage.getItem("restocash_user_role") ||
            "مشرف";
          setFallbackUser({
            email: raw,
            name: raw.split("@")[0],
            role,
          });
          return;
        }
      }
    } catch {
      // Ignore storage parse error
    }
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data?.session?.user) {
          setFallbackUser({
            email: data.session.user.email || "المسؤول",
            role: "مشرف النظام",
          });
        }
      })
      .catch(() => {
        // Ignore session error
      });
  }, [propUser]);

  const activeUser = propUser || fallbackUser;
  const { isRootDashboard, department: activeDepartment } = resolveNavigationState(
    location.pathname,
    location.search,
    (location as { searchStr?: string }).searchStr,
  );

  const visibleDepartments = NAVIGATION_DEPARTMENTS.filter((dept) => {
    if (hasDepartmentPermission) return hasDepartmentPermission(dept);
    return isDepartmentPermitted(activePerms, dept);
  });

  const handleLogout = async () => {
    if (onSignOut) {
      await onSignOut();
      return;
    }
    try {
      await signOutCurrentUser();
    } catch {
      // Ignore signout error
    }
    navigate({ to: "/login" });
  };

  const displayName =
    activeUser?.name || activeUser?.email?.split("@")[0] || (isEn ? "Administrator" : "المسؤول");
  const rawRole = String(activeUser?.role || "admin").toLowerCase();
  const displayRole =
    rawRole === "admin" || rawRole === "super_admin"
      ? isEn
        ? "System Admin"
        : "مدير النظام"
      : rawRole === "manager"
        ? isEn
          ? "Finance Manager"
          : "محاسب / مشرف"
        : rawRole === "cashier"
          ? isEn
            ? "POS Cashier"
            : "كاشير"
          : rawRole === "captain"
            ? isEn
              ? "Floor Captain"
              : "كابتن صالة"
            : rawRole === "kitchen"
              ? isEn
                ? "Kitchen Chef"
                : "شيف المطبخ"
              : activeUser?.role || (isEn ? "Supervisor" : "مشرف");

  return (
    <header
      data-studio-preserve="top-navigation-bar"
      className={cn(
        "sticky top-0 z-40 shrink-0 bg-card/90 backdrop-blur-xl border-b border-border/90 px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-3 shadow-2xs",
        className,
      )}
      dir={isEn ? "ltr" : "rtl"}
    >
      {/* Brand Logo + Quick Departments Switcher */}
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        <Link
          to="/admin"
          onClick={() => dispatchSubTabCommand("/admin", "")}
          className="flex items-center gap-2 shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl py-1"
          title={isEn ? "Return to Main Departments Hub" : "العودة إلى لوحة الأقسام الرئيسية"}
        >
          <RestocashLogo size={22} showDeveloper={false} />
        </Link>

        <span className="h-5 w-px bg-border hidden sm:inline-block shrink-0" aria-hidden="true" />

        {/* Quick Departments Dropdown Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-muted/70 hover:bg-muted text-foreground border border-border/80 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title={isEn ? "Quick Switch Between Modules" : "الانتقال السريع بين أقسام النظام"}
            >
              <Grid3X3 size={14} className="text-primary shrink-0" />
              <span className="hidden md:inline">
                {isEn ? "System Modules" : "الأقسام الرئيسية"}
              </span>
              <span className="md:hidden">{isEn ? "Modules" : "الأقسام"}</span>
              <ChevronDown size={13} className="text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn("w-64 p-1.5 rounded-xl shadow-lg border-border", isEn ? "text-left" : "text-right")}
          >
            <DropdownMenuItem
              onClick={() => {
                dispatchSubTabCommand("/admin", "");
                navigate({ to: "/admin" });
              }}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer",
                isRootDashboard && "bg-primary/10 text-primary font-extrabold",
              )}
            >
              <Grid3X3 size={15} className="text-primary shrink-0" />
              <span>{isEn ? "Main Departments Hub" : "لوحة الأقسام الرئيسية"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            {visibleDepartments.map((dept) => {
              const Icon = dept.icon;
              const isActive = activeDepartment?.id === dept.id;
              return (
                <DropdownMenuItem
                  key={dept.id}
                  onClick={() => {
                    dispatchSubTabCommand(dept.to, dept.search?.tab || "");
                    navigate({ to: dept.to, search: dept.search });
                  }}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer",
                    isActive && "bg-primary/10 text-primary font-extrabold",
                  )}
                >
                  <Icon
                    size={15}
                    className={cn(
                      "shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="truncate">{dept.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Controls Zone: QR Self-Order Alert, Language, Currency, Theme Toggle, Version & User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {isRestaurantScreen && pendingSelfOrdersCount > 0 && (
          <Link
            to="/captain"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black border shadow-xs transition-all animate-pulse shrink-0",
              hasUrgentTableCall
                ? "bg-red-600 text-white border-red-700 hover:bg-red-700"
                : "bg-amber-500 text-slate-950 border-amber-600 hover:bg-amber-400",
            )}
            title={
              isEn
                ? "Open Captain Screen to review customer QR orders"
                : "اضغط لفتح شاشة الكابتن ومراجعة طلبات العملاء الذاتية"
            }
          >
            <BellRing size={14} className="animate-bounce shrink-0" />
            <span className="hidden sm:inline">
              {hasUrgentTableCall
                ? isEn
                  ? "Table Call / QR Orders"
                  : "استدعاء طاولة / طلبات QR"
                : isEn
                  ? "Customer QR Orders"
                  : "طلبات عملاء QR"}
            </span>
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-black/20 text-[11px] font-black tabular-nums">
              {pendingSelfOrdersCount}
            </span>
          </Link>
        )}

        <div
          data-studio-preserve="currency-switcher-tools"
          className="flex items-center gap-1.5 sm:gap-2 shrink-0"
        >
          <LanguageSwitcher compact />
          <CurrencySwitcher compact />
        </div>

        {/* Integrated 6-Mode 4K Theme Switcher */}
        <ThemeToggle className="h-8 rounded-xl border-border/80 bg-muted/60 hover:bg-muted text-foreground shrink-0" />

        {/* System Version Link */}
        {showSystemVersionLink && (
          <Link
            to="/admin/system-update"
            className="hidden xl:inline-flex items-center text-[11px] text-muted-foreground hover:text-foreground font-mono tabular-nums bg-muted/50 px-2 py-1 rounded-lg border border-border/70 whitespace-nowrap shrink-0 transition-colors"
            title={isEn ? "System Updates & Backup" : "تحديثات النظام"}
          >
            v{CURRENT_VERSION}
          </Link>
        )}

        {/* User Profile & Sign Out */}
        <div className="flex items-center gap-2 bg-muted/60 border border-border/80 px-2.5 py-1 rounded-xl shrink-0">
          <div className="hidden sm:flex h-6 w-6 rounded-lg bg-primary/15 text-primary items-center justify-center shrink-0">
            <ShieldCheck size={13} />
          </div>
          <div className={cn("hidden lg:block max-w-[130px]", isEn ? "text-left" : "text-right")}>
            <p className="text-[11px] font-extrabold text-foreground truncate leading-tight">
              {displayName}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold truncate leading-tight">
              {displayRole}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={handleLogout}
            title={isEn ? "Sign Out" : "تسجيل الخروج"}
            aria-label={isEn ? "Sign Out" : "تسجيل الخروج"}
          >
            <LogOut size={14} />
          </Button>
        </div>
      </div>
    </header>
  );
}
