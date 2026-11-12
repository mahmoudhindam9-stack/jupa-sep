import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
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
import { useSettings } from "@/hooks/use-settings";
import {
  getActiveUserPermissionsSync,
  isDepartmentPermitted,
} from "@/shared/services/userAuthorization";
import {
  NAVIGATION_DEPARTMENTS,
  getActiveDepartment,
  getActiveSubsection,
  getActiveSubpageInfo,
  type NavDepartment,
  type NavSubsection,
} from "./navigationRegistry";

interface AppBreadcrumbBarProps {
  hasDepartmentPermission?: (dept: NavDepartment) => boolean;
  /** Optional custom label when on a specialized screen */
  customSection?: {
    labelAr: string;
    labelEn: string;
    to?: string;
  };
  customSubsection?: {
    labelAr: string;
    labelEn: string;
  };
  /** Optional custom back handler */
  onBack?: () => void;
  backTo?: string;
}

export function AppBreadcrumbBar({
  hasDepartmentPermission,
  customSection,
  customSubsection,
  onBack,
  backTo,
}: AppBreadcrumbBarProps) {
  const { lang } = useSettings();
  const isAr = (lang || "ar") === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const location = useLocation();
  const navigate = useNavigate();

  const pathname = location.pathname;
  const searchStr =
    (location as any).searchStr ??
    (typeof window !== "undefined" ? window.location.search : "");

  const isRootDashboard =
    (pathname === "/admin" || pathname === "/admin/") &&
    (!searchStr ||
      searchStr === "" ||
      searchStr.includes("tab=overview") ||
      searchStr.includes("tab=grid"));

  const activePerms = useMemo(() => getActiveUserPermissionsSync(), [pathname]);

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

  const activeSubsection = useMemo(
    () => getActiveSubsection(activeDepartment, pathname, searchStr),
    [activeDepartment, pathname, searchStr],
  );

  const activeSubpage = useMemo(
    () => getActiveSubpageInfo(pathname, searchStr),
    [pathname, searchStr],
  );

  // Hide breadcrumb bar on the main root hub unless a custom section is explicitly provided
  if (isRootDashboard && !customSection) {
    return null;
  }

  const SeparatorChevron = isAr ? ChevronLeft : ChevronRight;
  const BackArrow = isAr ? ArrowRight : ArrowLeft;

  const handleNavigate = (to: string, search?: Record<string, string>) => {
    navigate({
      to: to as any,
      search: search ? (search as any) : undefined,
    });
  };

  const handleSubNavigate = (sub: NavSubsection) => {
    navigate({
      to: sub.to as any,
      search: sub.search ? (sub.search as any) : undefined,
    });
  };

  const handleBackClick = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (backTo) {
      handleNavigate(backTo);
      return;
    }
    if (activeSubpage) {
      handleNavigate(activeSubpage.parentPath, { tab: activeSubpage.parentTab });
      return;
    }
    handleNavigate("/admin");
  };

  const resolvedSubsectionBadge = customSubsection || activeSubpage;

  return (
    <nav
      dir={dir}
      aria-label="Breadcrumb"
      className="min-h-10 py-1.5 bg-muted/40 border-b border-border/80 px-3 sm:px-5 flex items-center justify-between gap-2 text-xs shrink-0 print:hidden"
    >
      {/* Breadcrumb Trail + Quick Switchers */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap min-w-0">
        {/* 1. Root Hub Link */}
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 font-semibold transition-colors shrink-0"
        >
          <Home className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">
            {isAr ? "الأقسام الرئيسية" : "Main Hub"}
          </span>
        </Link>

        {/* 2. Active Department (Clicking label navigates to department root, clicking chevron switches department) */}
        {(activeDepartment || customSection) && (
          <>
            <SeparatorChevron className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            {activeDepartment ? (
              <div className="inline-flex items-center rounded-md bg-background border border-border/70 hover:border-primary/40 text-foreground font-bold shadow-2xs transition-colors overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleNavigate(activeDepartment.to, activeDepartment.search)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 hover:bg-muted/60 transition-colors cursor-pointer text-foreground"
                  title={isAr ? `الرجوع إلى ${activeDepartment.labelAr}` : `Back to ${activeDepartment.labelEn}`}
                >
                  <activeDepartment.icon className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {isAr ? activeDepartment.labelAr : activeDepartment.labelEn}
                  </span>
                </button>
                <div className="w-px h-4 bg-border/70 shrink-0" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={isAr ? "الانتقال إلى قسم آخر" : "Switch Department"}
                      className="px-1.5 py-1 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align={isAr ? "start" : "end"}
                    className="w-60 max-h-[70vh] overflow-y-auto p-1.5"
                  >
                    <DropdownMenuLabel className="text-[11px] text-muted-foreground px-2 py-1">
                      {isAr ? "الانتقال إلى قسم آخر" : "Switch Department"}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {visibleDepartments.map((dept) => {
                      const Icon = dept.icon;
                      const isCurrent = dept.id === activeDepartment.id;
                      return (
                        <DropdownMenuItem
                          key={dept.id}
                          onClick={() => handleNavigate(dept.to, dept.search)}
                          className={`gap-2 py-2 cursor-pointer text-xs rounded-md ${
                            isCurrent
                              ? "bg-primary/10 text-primary font-bold"
                              : "font-medium"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">
                            {isAr ? dept.labelAr : dept.labelEn}
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : customSection ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border/70 text-foreground font-bold">
                {isAr ? customSection.labelAr : customSection.labelEn}
              </span>
            ) : null}
          </>
        )}

        {/* 3. Subsections 3-part Capsule directly next to Department switcher (Definitions | Operations | Reports) */}
        {activeDepartment && activeDepartment.children.length > 0 && (
          <>
            <SeparatorChevron className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <div
              data-testid="breadcrumb-subsections-capsule"
              className="inline-flex items-center gap-0.5 rounded-lg bg-background border border-border/80 p-0.5 shadow-2xs"
            >
              {activeDepartment.children.map((sub) => {
                const SubIcon = sub.icon;
                const isSubCurrent = activeSubsection?.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSubNavigate(sub)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      isSubCurrent
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                    title={isAr ? sub.labelAr : sub.labelEn}
                  >
                    {SubIcon && <SubIcon className="w-3.5 h-3.5 shrink-0" />}
                    <span>{isAr ? sub.labelAr : sub.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* 4. Active Subpage or Custom Subsection Badge */}
        {resolvedSubsectionBadge && (
          <>
            <SeparatorChevron className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-700/10 border border-emerald-600/30 text-emerald-800 dark:text-emerald-300 font-bold">
              {isAr ? resolvedSubsectionBadge.labelAr : resolvedSubsectionBadge.labelEn}
            </span>
          </>
        )}
      </div>

      {/* Quick Back Button */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackClick}
          className="h-7 px-2.5 text-xs font-bold text-muted-foreground hover:text-foreground gap-1.5"
        >
          <BackArrow className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {activeSubpage
              ? isAr
                ? `رجوع إلى ${
                    activeSubpage.parentTab === "definitions"
                      ? "التعريفات"
                      : activeSubpage.parentTab === "reports"
                        ? "التقارير"
                        : "العمليات"
                  }`
                : "Back to Section"
              : isAr
                ? "رجوع للأقسام الرئيسية"
                : "Back to Hub"}
          </span>
        </Button>
      </div>
    </nav>
  );
}
