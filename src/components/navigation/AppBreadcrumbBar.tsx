import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronDown,
  ArrowRight,
  Grid3X3,
  Check,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NAVIGATION_DEPARTMENTS,
  resolveNavigationState,
  subscribeSubTabState,
  dispatchSubTabCommand,
  type NavSubItem,
} from "./navigationRegistry";
import { cn } from "@/lib/utils";

export interface BreadcrumbNode {
  label: string;
  to?: string;
  search?: Record<string, string>;
  icon?: LucideIcon;
  isLeaf?: boolean;
}

export interface AppBreadcrumbBarProps {
  /** Optional custom section override */
  customSection?: {
    label: string;
    to: string;
    icon?: LucideIcon;
  };
  /** Optional custom subsection override */
  customSubsection?: {
    label: string;
    icon?: LucideIcon;
  };
  className?: string;
}

export function AppBreadcrumbBar({
  customSection,
  customSubsection,
  className,
}: AppBreadcrumbBarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Re-render whenever a department page updates its local active sub-tab
  const [, setSyncTick] = useState(0);
  useEffect(() => {
    return subscribeSubTabState(() => {
      setSyncTick((t) => t + 1);
    });
  }, []);

  const resolved = resolveNavigationState(
    location.pathname,
    location.search,
    (location as { searchStr?: string }).searchStr,
  );

  // Hide completely on the root dashboard (/admin without sub-tab) unless customSection is provided
  if (resolved.isRootDashboard && !customSection) {
    return null;
  }

  const department = resolved.department;
  const subItem = resolved.subItem || department?.children[0] || null;
  const defaultHubSubItem = department?.children[0] || null;
  const isInsideDeepSubItem = Boolean(
    (customSection && customSubsection) ||
      (department && subItem && defaultHubSubItem && subItem.id !== defaultHubSubItem.id),
  );

  const handleGoToRootHub = () => {
    dispatchSubTabCommand("/admin", "");
    navigate({ to: "/admin" });
  };

  const handleGoToDepartmentHub = (deptTo: string, deptSearch?: Record<string, string>) => {
    dispatchSubTabCommand(deptTo, deptSearch?.tab || "");
    navigate({ to: deptTo, search: deptSearch });
  };

  const handleNavigateSubItem = (item: NavSubItem) => {
    const targetTab = item.tabValue || item.search?.tab || "";
    dispatchSubTabCommand(item.to, targetTab);
    navigate({ to: item.to, search: item.search });
  };

  // Smart back button handler
  const handleQuickBack = () => {
    if (customSection && customSubsection) {
      handleGoToDepartmentHub(customSection.to);
      return;
    }
    if (isInsideDeepSubItem && department) {
      handleGoToDepartmentHub(department.to, department.search);
      return;
    }
    handleGoToRootHub();
  };

  const parentLabel =
    customSection?.label ||
    department?.label ||
    resolved.fallbackLabel ||
    "القسم الرئيسي";
  const ParentIcon = customSection?.icon || department?.icon;

  // Always resolve the 3rd level (sub-section label) when inside a department
  const subLabel =
    customSubsection?.label ||
    subItem?.label ||
    (department ? `لوحة ${department.label}` : undefined);
  const SubIcon = customSubsection?.icon || subItem?.icon || ParentIcon;

  return (
    <nav
      aria-label="مسار التنقل الهرمي"
      dir="rtl"
      className={cn(
        "sticky top-14 z-30 shrink-0 bg-muted/50 backdrop-blur-md border-b border-border/80 px-3 sm:px-6 py-1.5 shadow-2xs transition-colors",
        className,
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Interactive 3-Level Hierarchical Breadcrumb Trail */}
        <ol
          className="flex items-center gap-1 sm:gap-1.5 flex-wrap min-w-0"
          role="list"
        >
          {/* 1. Root Hub Link (لوحة الأقسام) */}
          <li className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleGoToRootHub}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-muted-foreground hover:text-foreground hover:bg-card/80 border border-transparent hover:border-border/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="الانتقال إلى لوحة الأقسام الرئيسية"
            >
              <Grid3X3 size={14} className="text-primary shrink-0" />
              <span>لوحة الأقسام</span>
            </button>
          </li>

          {/* Separator 1 */}
          <li
            aria-hidden="true"
            className="flex items-center shrink-0 text-muted-foreground/60"
          >
            <ChevronLeft size={15} className="rtl:rotate-0 ltr:rotate-180" />
          </li>

          {/* 2. Main Department Node (Clickable link to Department Hub + Quick Department Switcher) */}
          <li className="flex items-center gap-0.5 shrink-0">
            <div className="inline-flex items-center rounded-lg border border-border/70 bg-card/80 hover:bg-card transition-colors shadow-2xs">
              <button
                type="button"
                onClick={() =>
                  handleGoToDepartmentHub(
                    customSection?.to || department?.to || "/admin",
                    department?.search,
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 font-bold text-foreground/85 hover:text-primary transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title={`الانتقال إلى ${parentLabel}`}
              >
                {ParentIcon && (
                  <ParentIcon size={14} className="text-primary shrink-0" />
                )}
                <span>{parentLabel}</span>
              </button>

              {/* Quick switcher between main departments */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="px-1.5 py-1 text-muted-foreground hover:text-foreground border-r border-border/60 cursor-pointer rounded-l-lg"
                    title="تبديل القسم الرئيسي"
                    aria-label="تبديل القسم الرئيسي"
                  >
                    <ChevronDown size={13} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-60 p-1.5 font-cairo text-right"
                >
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground px-2 py-1">
                    الانتقال السريع لقسم رئيسي آخر
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1" />
                  {NAVIGATION_DEPARTMENTS.map((dept) => {
                    const DeptIcon = dept.icon;
                    const isCurrentDept = dept.id === department?.id;
                    return (
                      <DropdownMenuItem
                        key={dept.id}
                        onClick={() =>
                          handleGoToDepartmentHub(dept.to, dept.search)
                        }
                        className={cn(
                          "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer",
                          isCurrentDept &&
                            "bg-primary/10 text-primary font-black",
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <DeptIcon
                            size={14}
                            className={cn(
                              "shrink-0",
                              isCurrentDept
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          />
                          <span className="truncate">{dept.label}</span>
                        </div>
                        {isCurrentDept && (
                          <Check size={13} className="text-primary shrink-0" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>

          {/* 3. Sub-section / Active Screen Node (ALWAYS shown when inside a department) */}
          {subLabel && (
            <>
              {/* Separator 2 */}
              <li
                aria-hidden="true"
                className="flex items-center shrink-0 text-muted-foreground/60"
              >
                <ChevronLeft size={15} className="rtl:rotate-0 ltr:rotate-180" />
              </li>

              <li className="flex items-center shrink-0 min-w-0">
                {department && department.children.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-current="page"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-primary bg-primary/10 hover:bg-primary/15 border border-primary/25 shadow-2xs transition-colors cursor-pointer max-w-[240px] sm:max-w-none truncate"
                        title="القسم الفرعي الحالي — انقر للتبديل السريع إلى قسم فرعي آخر"
                      >
                        {SubIcon && (
                          <SubIcon size={14} className="shrink-0 text-primary" />
                        )}
                        <span className="truncate">{subLabel}</span>
                        <ChevronDown
                          size={13}
                          className="shrink-0 text-primary/80"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-64 p-1.5 font-cairo text-right"
                    >
                      <DropdownMenuLabel className="text-[11px] text-muted-foreground px-2 py-1">
                        الأقسام الفرعية داخل {department.label}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="my-1" />
                      {department.children.map((sibling) => {
                        const SiblingIcon = sibling.icon;
                        const isActiveSibling = sibling.id === subItem?.id;
                        return (
                          <DropdownMenuItem
                            key={sibling.id}
                            onClick={() => handleNavigateSubItem(sibling)}
                            className={cn(
                              "flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-bold cursor-pointer",
                              isActiveSibling &&
                                "bg-primary/10 text-primary font-black",
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <SiblingIcon
                                size={14}
                                className={cn(
                                  "shrink-0",
                                  isActiveSibling
                                    ? "text-primary"
                                    : "text-muted-foreground",
                                )}
                              />
                              <span className="truncate">{sibling.label}</span>
                            </div>
                            {isActiveSibling && (
                              <Check
                                size={13}
                                className="text-primary shrink-0"
                              />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span
                    aria-current="page"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-primary bg-primary/10 border border-primary/20 shadow-2xs max-w-[240px] sm:max-w-none truncate"
                  >
                    {SubIcon && (
                      <SubIcon size={14} className="shrink-0 text-primary" />
                    )}
                    <span className="truncate">{subLabel}</span>
                  </span>
                )}
              </li>
            </>
          )}
        </ol>

        {/* Smart Quick Back Action Button */}
        <div className="shrink-0 flex items-center">
          <button
            type="button"
            onClick={handleQuickBack}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-muted-foreground hover:text-foreground bg-card/80 hover:bg-card rounded-lg border border-border/70 transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            title={
              isInsideDeepSubItem
                ? `العودة إلى ${parentLabel}`
                : "العودة إلى لوحة الأقسام الرئيسية"
            }
          >
            <ArrowRight size={14} className="shrink-0" />
            <span className="hidden sm:inline">
              {isInsideDeepSubItem
                ? `العودة لـ ${parentLabel}`
                : "العودة للوحة الأقسام"}
            </span>
            <span className="sm:hidden">رجوع</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
