import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/features/auth/services/authService";
import { erpStore } from "@/shared/services/erpStore";

function isHostedDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !host.endsWith(".localhost");
}

function hasAnyRequestedPermission(permissions: Record<string, any>, keys: string[]): boolean {
  if (permissions.super_admin_full_access === true) return true;
  return keys.some((key) => permissions[key] === true);
}

export async function currentUserHasPermission(keys: string[]): Promise<boolean> {
  if (isHostedDeployment()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return false;
    const profile: any = await authService.getProfile(session.user.id);
    if (!profile?.id || !profile?.username) return false;
    return hasAnyRequestedPermission(profile.permissions || {}, keys);
  }

  const activeStored =
    localStorage.getItem("restocash_auth_user") ||
    sessionStorage.getItem("restocash_auth_user") ||
    "";
  const active = activeStored.trim().toLowerCase();
  if (!active) return false;
  const base = active.split("@")[0];
  const users = erpStore.getUsers() as any[];
  const user = users.find((candidate) => {
    const username = String(candidate.username || "").trim().toLowerCase();
    if (!username || !candidate.password) return false;
    return username.includes("@") ? username === active : username === base;
  });
  if (!user) return false;

  const state: any = erpStore.getState();
  const permissions =
    (user.permissions && Object.keys(user.permissions).length > 0 ? user.permissions : null) ||
    state.userPermissions?.[user.username] ||
    state.userPermissions?.[user.role] ||
    {};
  return hasAnyRequestedPermission(permissions, keys);
}

export async function signOutCurrentUser(): Promise<void> {
  localStorage.removeItem("restocash_auth_user");
  localStorage.removeItem("restocash_user_role");
  sessionStorage.removeItem("restocash_auth_user");
  sessionStorage.removeItem("restocash_user_role");
  await supabase.auth.signOut().catch(() => undefined);
}
