import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  Grid3X3,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RestocashLogo } from "@/components/RestocashLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { CURRENT_VERSION } from "@/shared/config/version";
import { useSettings } from "@/hooks/use-settings";
import {
  getActiveUserPermissionsSync,
  getCurrentUserIdentitySync,
  isDepartmentPermitted,
  signOutCurrentUser,
} from "@/shared/services/userAuthorization";
import {
  NAVIGATION_DEPARTMENTS,
  getActiveDepartment,
  type NavDepartment,
} from "./navigationRegistry";

interface AppMainNavbarProps {
  user?: {
    email?: string;
    username?: string;
    role?: string;
    full_name?: string;
  } | null;
  userName?: string | null;
  userRoleLabel?: string | null;
  onSignOut?: () => void;
  hasDepartmentPermission?: (dept: NavDepartment) => boolean;
  showSystemVersionLink?: boolean;
  pendingQrCount?: number;
  onQrBadgeClick?: () => void;
  extraActions?: React.ReactNode;
}

export function AppMainNavbar({
  user,
  userName,
  userRoleLabel,
  onSignOut,
  hasDepartmentPermission,
  showSystemVersionLink = true,
  pendingQrCount = 0,
  onQrBadgeClick,
  extraActions,
}: AppMainNavbarProps) {
  const { lang } = useSettings();
  const isAr = (lang || "ar") === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const location = useLocation();
  const navigate = useNavigate();

  const pathname = location.pathname;
  const searchStr = typeof window !== "undefined" ? window.location.search : "";

  const activePerms = useMemo(() => getActiveUserPermissionsSync(), [pathname, user]);
  const identity = useMemo(() => getCurrentUserIdentitySync(), [pathname, user]);

  const resolvedUserName =
    userName ||
    user?.full_name ||
    user?.username ||
    user?.email ||
    identity.fullName ||
    identity.username;

  const resolvedRoleLabel =
    userRoleLabel || user?.role || identity.role || "";

  const visibleDepartments = useMemo(() => {
    return NAVIGATION_DEPARTMENTS.filter((dept) =>
      hasDepartmentPermission
        ? hasDepartmentPermission(dept)
        : isDepartmentPermitted(activePerms, dept),
    );
  }, [hasDepartmentPermission, activePerms]);

  const activeDepartment = useMemo(
    () => getActiveDepartment(pathname, searchStr),
    [pathname, searchStr],
  );

  const handleNavigate = (to: string, search?: Record<string, string>) => {
    navigate({
      to: to as any,
      search: search ? (search as any) : undefined,
    });
  };

  const handleLogout = async () => {
    if (onSignOut) {
      onSignOut();
      return;
    }
    await signOutCurrentUser();
    navigate({ to: "/login" as any });
  };

  return (
    <header
      dir={dir}
      className="h-14 border-b border-border bg-card/95 backdrop-blur-md flex items-center justify-between gap-2 px-3 sm:px-5 shrink-0 sticky top-0 z-40 shadow-xs print:hidden"
    >
      {/* Start: Brand + Quick Departments Switcher */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
        <Link
          to="/admin"
          className="flex items-center gap-2 group focus:outline-none shrink-0"
          title={isAr ? "العودة إلى لوحة الأقسام الرئيسية" : "Return to Main Hub"}
        >
          <RestocashLogo size={24} />
        </Link>

        <div className="h-5 w-px bg-border hidden sm:block shrink-0" />

        {/* Quick Department Switcher Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 sm:px-3 text-xs font-bold border-border/80 bg-background/70 hover:bg-muted/80 rounded-lg shrink-0"
            >
              <Grid3X3 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[110px] sm:max-w-[170px]">
                {activeDepartment
                  ? isAr
                    ? activeDepartment.labelAr
                    : activeDepartment.labelEn
                  : isAr
                    ? "الأقسام الرئيسية"
                    : "System Modules"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={isAr ? "start" : "end"}
            className="w-64 max-h-[75vh] overflow-y-auto p-1.5"
          >
            <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground px-2 py-1">
              {isAr ? "التنقل السريع بين الأقسام" : "Quick Module Switcher"}
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => handleNavigate("/admin")}
              className="gap-2.5 py-2 cursor-pointer font-bold text-xs rounded-lg"
            >
              <Grid3X3 className="w-4 h-4 text-primary shrink-0" />
              <span>
                {isAr ? "لوحة الأقسام الرئيسية" : "Main Modules Hub"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {visibleDepartments.map((dept) => {
              const Icon = dept.icon;
              const isCurrent = activeDepartment?.id === dept.id;
              return (
                <DropdownMenuItem
                  key={dept.id}
                  onClick={() => handleNavigate(dept.to, dept.search)}
                  className={`gap-2.5 py-2 cursor-pointer text-xs rounded-lg ${
                    isCurrent
                      ? "bg-primary/10 text-primary font-bold"
                      : "font-medium"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isCurrent ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span className="truncate">
                    {isAr ? dept.labelAr : dept.labelEn}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* End: Utilities, Notifications, Version, Profile, Logout */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0">
        {extraActions}

        {pendingQrCount > 0 && (
          <button
            type="button"
            onClick={onQrBadgeClick}
            className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-lg text-xs font-bold animate-pulse hover:bg-rose-500/20 transition-colors shrink-0"
            title={
              isAr ? "طلبات الطاولات الذاتية" : "Self-Service QR Orders"
            }
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {isAr
                ? `${pendingQrCount} طلب طاولة`
                : `${pendingQrCount} QR Order`}
            </span>
            <span className="md:hidden">{pendingQrCount}</span>
          </button>
        )}

        <LanguageSwitcher compact />
        <CurrencySwitcher compact />
        <ThemeToggle />

        {showSystemVersionLink && (
          <Link
            to="/admin/system-update"
            className="hidden lg:flex items-center gap-1.5 text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 px-2.5 py-1 rounded-lg transition-colors shrink-0"
            title={
              isAr ? "تحديث النظام والنسخ الاحتياطي" : "System Update & Backup"
            }
          >
            <RefreshCw className="w-3 h-3" />
            <span>v{CURRENT_VERSION}</span>
          </Link>
        )}

        {(resolvedUserName || onSignOut) && (
          <div className="flex items-center gap-1.5 ps-1.5 sm:ps-2 border-s border-border shrink-0">
            {resolvedUserName && (
              <div className="text-end hidden xl:block leading-tight">
                <p className="text-xs font-bold text-foreground truncate max-w-[110px]">
                  {resolvedUserName}
                </p>
                {resolvedRoleLabel && (
                  <p className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                    {resolvedRoleLabel}
                  </p>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
              onClick={handleLogout}
              title={isAr ? "تسجيل الخروج" : "Sign Out"}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
