import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Grid3X3, LogOut } from "lucide-react";
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
import { signOutCurrentUser } from "@/shared/services/userAuthorization";
import {
  NAVIGATION_DEPARTMENTS,
  resolveNavigationState,
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
  const location = useLocation();
  const navigate = useNavigate();
  const [fallbackUser, setFallbackUser] = useState<AppMainNavbarUser | null>(null);

  useEffect(() => {
    if (propUser) return;
    try {
      const raw =
        localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setFallbackUser(parsed);
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

  const visibleDepartments = hasDepartmentPermission
    ? NAVIGATION_DEPARTMENTS.filter(hasDepartmentPermission)
    : NAVIGATION_DEPARTMENTS;

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
    activeUser?.name || activeUser?.email?.split("@")[0] || "المسؤول";
  const displayRole = activeUser?.role || "مشرف";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 shrink-0 bg-card/95 backdrop-blur-md border-b border-border px-3 sm:px-6 h-14 flex items-center justify-between gap-3 shadow-2xs",
        className,
      )}
      dir="rtl"
    >
      {/* Right Zone (RTL): Brand Logo & Program Name + Quick Departments Switcher */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        <Link
          to="/admin"
          onClick={() => dispatchSubTabCommand("/admin", "")}
          className="flex items-center gap-2 shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
          title="العودة إلى لوحة الأقسام الرئيسية"
        >
          <RestocashLogo size={26} />
          <span className="font-black text-sm sm:text-base tracking-tight text-foreground group-hover:text-primary transition-colors whitespace-nowrap shrink-0">
            Restocash ERP
          </span>
        </Link>

        <span className="h-5 w-px bg-border/80 hidden sm:inline-block shrink-0" aria-hidden="true" />

        {/* Quick Departments Dropdown Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-muted/60 hover:bg-muted text-foreground border border-border/70 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="الانتقال السريع بين أقسام النظام"
            >
              <Grid3X3 size={14} className="text-primary shrink-0" />
              <span className="hidden md:inline">الأقسام الرئيسية</span>
              <span className="md:hidden">الأقسام</span>
              <ChevronDown size={13} className="text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 p-1.5 font-cairo" dir="rtl">
            <DropdownMenuItem
              onClick={() => {
                dispatchSubTabCommand("/admin", "");
                navigate({ to: "/admin" });
              }}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-bold cursor-pointer",
                isRootDashboard && "bg-primary/10 text-primary font-black",
              )}
            >
              <Grid3X3 size={15} className="text-primary shrink-0" />
              <span>لوحة الأقسام الرئيسية</span>
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
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-bold cursor-pointer",
                    isActive && "bg-primary/10 text-primary font-black",
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

      {/* Left Zone (RTL): Language, Currency, Theme Toggle, Version & User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <div
          data-studio-preserve="currency-switcher-tools"
          className="flex items-center gap-1.5 sm:gap-2 shrink-0"
        >
          <LanguageSwitcher compact />
          <CurrencySwitcher compact />
        </div>

        {/* Integrated Theme Toggle (Dark / Light mode) */}
        <ThemeToggle className="h-8 w-8 rounded-lg border-border/80 bg-muted/60 hover:bg-muted text-foreground shrink-0" />

        {/* System Version Link */}
        {showSystemVersionLink && (
          <Link
            to="/admin/system-update"
            className="hidden xl:inline-flex items-center text-[11px] text-muted-foreground hover:text-foreground font-mono tabular-nums bg-muted/50 px-2 py-1 rounded-lg border border-border/60 whitespace-nowrap shrink-0 transition-colors"
            title="تحديثات النظام"
          >
            v{CURRENT_VERSION}
          </Link>
        )}

        {/* User Profile & Sign Out */}
        <div className="flex items-center gap-1.5 bg-muted/60 border border-border/80 px-2 py-1 rounded-xl shrink-0">
          <div className="text-right hidden lg:block max-w-[120px]">
            <p className="text-[11px] font-black text-foreground truncate leading-tight">
              {displayName}
            </p>
            <p className="text-[9px] text-muted-foreground font-semibold truncate leading-tight">
              {displayRole}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={handleLogout}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
          >
            <LogOut size={15} />
          </Button>
        </div>
      </div>
    </header>
  );
}
