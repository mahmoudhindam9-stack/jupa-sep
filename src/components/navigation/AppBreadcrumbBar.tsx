import React from "react";
import type { LucideIcon } from "lucide-react";
import type { NavDepartment } from "./navigationRegistry";

export interface BreadcrumbCustomSection {
  label: string;
  to: string;
  icon?: LucideIcon;
}

export interface BreadcrumbCustomSubsection {
  label: string;
  icon?: LucideIcon;
}

export interface AppBreadcrumbBarProps {
  hasDepartmentPermission?: (dept: NavDepartment) => boolean;
  customSection?: BreadcrumbCustomSection;
  customSubsection?: BreadcrumbCustomSubsection;
  className?: string;
}

/**
 * Navigation features have been consolidated directly into the single original
 * top navigation bar (`AppMainNavbar`) to eliminate duplicate navigation bars.
 */
export function AppBreadcrumbBar(_props: AppBreadcrumbBarProps): React.ReactElement | null {
  return null;
}
