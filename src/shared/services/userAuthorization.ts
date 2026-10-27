import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/features/auth/services/authService";
import { erpStore, ROOT_DEFAULT_ADMIN } from "@/shared/services/erpStore";
import { isAiStudioPreview, isHostedDeployment } from "@/shared/services/previewAccess";

export const PERMISSIONS_UPDATED_EVENT = "restocash:permissions-updated";

export function notifyPermissionsUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PERMISSIONS_UPDATED_EVENT));
  }
}

export function hasAnyRequestedPermission(
  permissions: Record<string, any> | null | undefined,
  keys: string[],
): boolean {
  if (!keys || keys.length === 0) return true;
  if (!permissions) return false;
  if (permissions.super_admin_full_access === true) return true;
  return keys.some((key) => permissions[key] === true);
}

/**
 * Resolves the active user's permissions synchronously from erpStore.
 * Used by UI grids, navbars, and action buttons for instant RBAC filtering.
 */
export function getActiveUserPermissionsSync(): Record<string, boolean> {
  if (typeof window === "undefined") return {};

  const state: any = erpStore.getState();
  const activeStored = (
    localStorage.getItem("restocash_auth_user") ||
    sessionStorage.getItem("restocash_auth_user") ||
    state.currentUser ||
    ""
  )
    .trim()
    .toLowerCase();

  const base = activeStored.split("@")[0];
  const users = erpStore.getUsers() as any[];

  const matchedUser = users.find((candidate) => {
    const username = String(candidate.username || "")
      .trim()
      .toLowerCase();
    const email = String(candidate.email || "")
      .trim()
      .toLowerCase();
    if (!username && !email) return false;
    return (
      (!!email && email === activeStored) ||
      username === activeStored ||
      username === base ||
      username.split("@")[0] === base
    );
  });

  if (matchedUser) {
    const userPerms =
      matchedUser.permissions && Object.keys(matchedUser.permissions).length > 0
        ? matchedUser.permissions
        : state.userPermissions?.[matchedUser.username] ||
          state.userPermissions?.[base] ||
          state.userPermissions?.[matchedUser.role];

    if (userPerms && Object.keys(userPerms).length > 0) {
      return userPerms as Record<string, boolean>;
    }

    if (matchedUser.role === "admin" || matchedUser.role === "super_admin") {
      return { super_admin_full_access: true };
    }
  }

  if (base && state.userPermissions?.[base] && Object.keys(state.userPermissions[base]).length > 0) {
    return state.userPermissions[base] as Record<string, boolean>;
  }

  // In preview container when no user has been selected yet, default to the root admin record's permissions
  if (!activeStored && isAiStudioPreview()) {
    const adminUser =
      users.find((u) => String(u.username || "").toLowerCase() === "admin") || ROOT_DEFAULT_ADMIN;
    return (adminUser.permissions || { super_admin_full_access: true }) as Record<string, boolean>;
  }

  return {};
}

export function hasActivePermissionSync(keys: string[]): boolean {
  const perms = getActiveUserPermissionsSync();
  return hasAnyRequestedPermission(perms, keys);
}

/**
 * Verifies the current user's permissions against Supabase `public.profiles` first
 * (whenever a Supabase Auth session is active), or against the active user profile
 * in `erpStore` when operating in a local/preview session.
 */
export async function currentUserHasPermission(keys: string[]): Promise<boolean> {
  if (!keys || keys.length === 0) return true;

  // 1. Always check Supabase Auth session first on ANY host so database permissions are authoritative
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      const profile: any = await authService.getProfile(session.user.id);
      if (!profile?.id || !profile?.username) return false;

      const username = String(profile.username).trim().toLowerCase();
      const permissions = (profile.permissions || {}) as Record<string, boolean>;
      erpStore.updateUserPermission(username, permissions);
      return hasAnyRequestedPermission(permissions, keys);
    }
  } catch (error) {
    console.warn("Supabase session permission check failed:", error);
  }

  // 2. If strictly hosted deployment with no Supabase session and no local session, fail closed
  const activeStored =
    (typeof window !== "undefined" &&
      (localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user"))) ||
    "";
  const active = activeStored.trim().toLowerCase();

  if (!active) {
    if (isAiStudioPreview()) {
      const perms = getActiveUserPermissionsSync();
      return hasAnyRequestedPermission(perms, keys);
    }
    return false;
  }

  const base = active.split("@")[0];
  const users = erpStore.getUsers() as any[];
  const user = users.find((candidate) => {
    const username = String(candidate.username || "")
      .trim()
      .toLowerCase();
    const email = String(candidate.email || "")
      .trim()
      .toLowerCase();
    if (!username && !email) return false;
    return (
      (!!email && email === active) ||
      username === active ||
      username === base ||
      username.split("@")[0] === base
    );
  });

  if (!user) return false;

  const state: any = erpStore.getState();
  const permissions =
    (user.permissions && Object.keys(user.permissions).length > 0 ? user.permissions : null) ||
    state.userPermissions?.[user.username] ||
    state.userPermissions?.[base] ||
    state.userPermissions?.[user.role] ||
    (user.role === "admin" || user.role === "super_admin"
      ? { super_admin_full_access: true }
      : {});

  return hasAnyRequestedPermission(permissions, keys);
}

export async function signOutCurrentUser(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem("restocash_auth_user");
    localStorage.removeItem("restocash_user_role");
    sessionStorage.removeItem("restocash_auth_user");
    sessionStorage.removeItem("restocash_user_role");
  }
  await supabase.auth.signOut().catch(() => undefined);
}
