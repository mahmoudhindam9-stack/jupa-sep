import { authService } from "@/features/auth/services/authService";
import { supabase } from "@/integrations/supabase/client";
import { erpStore, type SystemUser } from "@/shared/services/erpStore";

const QUEUE_KEY = "restocash_pending_user_sync_v1";
const SECRET_PREFIX = "restocash_pending_user_secret_v1:";
const DELETED_USERS_KEY = "restocash_deleted_usernames_v1";
const CHANGE_EVENT = "restocash-user-sync-updated";
export const GLOBAL_USERS_SYNC_SHIFT_ID = "GLOBAL_USERS_DIRECTORY_SYNC_V1";

function readDeletedUsernames(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DELETED_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((u) => String(u || "").trim().toLowerCase()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function addDeletedUsername(username: string): void {
  if (typeof window === "undefined") return;
  const norm = String(username || "").trim().toLowerCase();
  if (!norm) return;
  try {
    const set = new Set(readDeletedUsernames());
    set.add(norm);
    window.localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function removeDeletedUsername(username: string): void {
  if (typeof window === "undefined") return;
  const norm = String(username || "").trim().toLowerCase();
  if (!norm) return;
  try {
    const next = readDeletedUsernames().filter((u) => u !== norm);
    window.localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export async function pushUsersDirectorySnapshotToSupabase(
  customUsers?: SystemUser[],
): Promise<boolean> {
  try {
    const deletedUsernames = readDeletedUsernames();
    const deletedSet = new Set(deletedUsernames);
    const currentUsers = (customUsers || erpStore.getUsers()).filter(
      (u) =>
        Boolean(u?.id && u?.username) &&
        !deletedSet.has(String(u.username || "").trim().toLowerCase()),
    );
    // User-directory audit snapshots must never contain passwords or credential material.
    const safeUsers = currentUsers.map((user) => {
      const {
        password: _password,
        password_hash: _passwordHash,
        hashed_password: _hashedPassword,
        access_token: _accessToken,
        refresh_token: _refreshToken,
        ...safeUser
      } = user as any;
      return safeUser;
    });
    const state = erpStore.getState();
    const userPermissions = state.userPermissions || {};

    const { error } = await supabase.from("shift_audit_logs").insert({
      shift_id: GLOBAL_USERS_SYNC_SHIFT_ID,
      shift_type: "restaurant",
      shift_number: "USERS_DIRECTORY_SYNC",
      auto_shift_number: `USR-SYNC-${Date.now()}`,
      action: "UPDATE",
      status_before: "active",
      status_after: "synced",
      cashier_name: "UsersDirectorySync",
      performed_by: state.currentUser || "admin",
      details: `مزامنة تلقائية لدليل المستخدمين والصلاحيات (${currentUsers.length} مستخدم)`,
      metadata: {
        users: safeUsers,
        userPermissions,
        deletedUsernames,
        updatedAt: Date.now(),
      },
    } as any);

    if (error) {
      console.warn("[UserSync] Could not push users snapshot to Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[UserSync] Exception pushing users snapshot to Supabase:", err);
    return false;
  }
}

export async function pullUsersDirectorySnapshotFromSupabase(): Promise<{
  users: SystemUser[];
  userPermissions: Record<string, any>;
  deletedUsernames: string[];
  updatedAt: number;
} | null> {
  try {
    const { data, error } = await supabase
      .from("shift_audit_logs")
      .select("id, metadata, created_at")
      .eq("shift_id", GLOBAL_USERS_SYNC_SHIFT_ID)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    const row = data[0] as any;
    const meta = row?.metadata;
    if (!meta || !Array.isArray(meta.users)) {
      return null;
    }

    const remoteDeleted = Array.isArray(meta.deletedUsernames)
      ? meta.deletedUsernames.map((u: any) => String(u || "").trim().toLowerCase()).filter(Boolean)
      : [];

    if (typeof window !== "undefined" && remoteDeleted.length > 0) {
      try {
        const mergedDeleted = Array.from(new Set([...readDeletedUsernames(), ...remoteDeleted]));
        window.localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(mergedDeleted));
      } catch {
        // ignore
      }
    }

    return {
      users: meta.users.map((user: any) => {
        const {
          password: _password,
          password_hash: _passwordHash,
          hashed_password: _hashedPassword,
          access_token: _accessToken,
          refresh_token: _refreshToken,
          ...safeUser
        } = user || {};
        return safeUser as SystemUser;
      }),
      userPermissions: (meta.userPermissions || {}) as Record<string, any>,
      deletedUsernames: remoteDeleted,
      updatedAt: Number(meta.updatedAt || Date.parse(row.created_at) || Date.now()),
    };
  } catch (err) {
    console.warn("[UserSync] Exception pulling users snapshot from Supabase:", err);
    return null;
  }
}

type ProfilePayload = Record<string, any>;

interface QueuedBase {
  id: string;
  username: string;
  updatedAt: number;
  attempts: number;
  lastError?: string;
}

interface QueuedCreate extends QueuedBase {
  kind: "create";
  localUserId: string;
  email: string;
  profile: ProfilePayload;
  cloudUserId?: string;
}

interface QueuedUpsert extends QueuedBase {
  kind: "upsert";
  userId: string;
  profile: ProfilePayload;
}

interface QueuedDelete extends QueuedBase {
  kind: "delete";
  userId: string;
}

type QueuedChange = QueuedCreate | QueuedUpsert | QueuedDelete;

export type UserChangeInput =
  | {
      kind: "create";
      localUserId: string;
      username: string;
      email: string;
      password: string;
      profile: ProfilePayload;
    }
  | {
      kind: "upsert";
      userId: string;
      username: string;
      password?: string;
      profile: ProfilePayload;
    }
  | {
      kind: "delete";
      userId: string;
      username: string;
    };

export interface UserSyncResult {
  synced: boolean;
  pending: boolean;
  pendingCount: number;
  error?: string;
}

export interface UserSyncSummary {
  pendingCount: number;
  syncedCount: number;
  errorCount: number;
}

let activeSync: Promise<UserSyncSummary> | null = null;

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined";
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function normalizeUsername(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function createId(): string {
  return `user-change-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function announceChange(): void {
  if (canUseBrowserStorage()) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function readQueue(): QueuedChange[] {
  if (!canUseBrowserStorage()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? (parsed.filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            ["create", "upsert", "delete"].includes(item.kind),
        ) as QueuedChange[])
      : [];
  } catch (error) {
    console.warn("[UserSync] Unable to read pending changes.", error);
    return [];
  }
}

function writeQueue(queue: QueuedChange[], notify = true): void {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    if (notify) announceChange();
  } catch (error) {
    throw new Error(
      "تعذر حفظ قائمة المزامنة محليًا. وفّر مساحة في المتصفح ثم أعد المحاولة.",
      { cause: error },
    );
  }
}

function readCreatePassword(operationId: string): string {
  if (!canUseBrowserStorage()) return "";
  try {
    return window.sessionStorage.getItem(SECRET_PREFIX + operationId) || "";
  } catch {
    return "";
  }
}

function writeCreatePassword(operationId: string, password: string): void {
  if (!canUseBrowserStorage()) {
    throw new Error("لا يمكن حفظ كلمة المرور المؤقتة خارج المتصفح.");
  }
  try {
    window.sessionStorage.setItem(SECRET_PREFIX + operationId, password);
  } catch (error) {
    throw new Error("تعذر حفظ كلمة المرور المؤقتة لهذه الجلسة. أعد المحاولة.", {
      cause: error,
    });
  }
}

function clearCreatePassword(operationId: string): void {
  if (!canUseBrowserStorage()) return;
  try {
    window.sessionStorage.removeItem(SECRET_PREFIX + operationId);
  } catch {
    // The cloud account may already have been created; this is best-effort cleanup.
  }
}

function safeProfile(profile: ProfilePayload): ProfilePayload {
  const { id: _ignoredId, password: _ignoredPassword, ...safe } = (profile || {}) as ProfilePayload;
  return safe as ProfilePayload;
}

function profileToUser(profile: ProfilePayload): SystemUser {
  return {
    id: String(profile.id),
    full_name: profile.full_name || profile.username || "",
    username: String(profile.username || "").trim().toLowerCase(),
    email: String(profile.email || "").trim().toLowerCase(),
    phone: profile.phone || "",
    role: profile.role || "cashier",
    permissions: profile.permissions || {},
    created_at: profile.created_at || new Date().toISOString(),
  } as SystemUser;
}

function cacheConfirmedProfile(profile: ProfilePayload, localUserId?: string): void {
  if (!profile?.id || !profile?.username) {
    throw new Error("أعادت Supabase سجل مستخدم غير مكتمل بعد الحفظ.");
  }

  const remoteId = String(profile.id);
  if (localUserId && localUserId !== remoteId) {
    erpStore.deleteUser(localUserId);
  }

  const username = normalizeUsername(profile.username);
  const duplicate = erpStore.getUsers().find(
    (user) =>
      String(user.id) !== remoteId &&
      normalizeUsername(user.username) === username,
  );
  if (duplicate) erpStore.deleteUser(duplicate.id);

  erpStore.upsertUser(profileToUser(profile));
  erpStore.updateUserPermission(username, profile.permissions || {});
  announceChange();
}

/**
 * Once Supabase confirms the profiles table is empty, discard stale browser copies
 * and queued writes from the legacy directory. Otherwise an offline queue could
 * recreate users after the intentional server-side reset.
 */
export function resetLocalManagedUserDirectoryForBootstrap(): void {
  if (!canUseBrowserStorage()) return;

  try {
    window.localStorage.removeItem(QUEUE_KEY);
    window.localStorage.removeItem("restocash_auth_user");
    window.localStorage.removeItem("restocash_user_role");
    window.sessionStorage.removeItem("restocash_auth_user");
    window.sessionStorage.removeItem("restocash_user_role");

    const secretKeys = Array.from({ length: window.sessionStorage.length }, (_, index) =>
      window.sessionStorage.key(index),
    ).filter((key): key is string => !!key && key.startsWith(SECRET_PREFIX));
    for (const key of secretKeys) window.sessionStorage.removeItem(key);
  } catch (error) {
    console.warn("[UserSync] Could not clear all legacy browser user data.", error);
  }

  for (const user of erpStore.getUsers()) {
    try {
      erpStore.updateUserPermission(String(user.username || ""), {});
      erpStore.deleteUser(user.id);
    } catch (error) {
      console.warn("[UserSync] Could not remove a cached legacy user.", error);
    }
  }
  announceChange();
}

function operationKeyMatches(
  operation: QueuedChange,
  userId: string,
  username: string,
): boolean {
  const targetName = normalizeUsername(username);
  if (operation.kind === "create") {
    return (
      operation.localUserId === userId ||
      normalizeUsername(operation.username) === targetName
    );
  }
  return (
    operation.userId === userId ||
    (!!targetName && normalizeUsername(operation.username) === targetName)
  );
}

function persistUpdatedOperation(
  queue: QueuedChange[],
  updated: QueuedChange,
): void {
  writeQueue(queue.map((operation) => (operation.id === updated.id ? updated : operation)));
}

function enqueueChange(input: UserChangeInput): { operationId: string | null; noOp?: boolean } {
  const queue = readQueue();
  const now = Date.now();

  if (input.kind === "create") {
    const username = normalizeUsername(input.username);
    removeDeletedUsername(username);
    let existing = queue.find(
      (operation): operation is QueuedCreate =>
        operation.kind === "create" &&
        (operation.localUserId === input.localUserId ||
          normalizeUsername(operation.username) === username),
    );

    if (existing) {
      existing = {
        ...existing,
        email: input.email.trim().toLowerCase(),
        username,
        profile: { ...existing.profile, ...safeProfile(input.profile), username },
        updatedAt: now,
        lastError: undefined,
      };
      if (input.password) writeCreatePassword(existing.id, input.password);
      persistUpdatedOperation(queue, existing);
      return { operationId: existing.id };
    }

    const operation: QueuedCreate = {
      id: createId(),
      kind: "create",
      localUserId: input.localUserId,
      email: input.email.trim().toLowerCase(),
      username,
      profile: { ...safeProfile(input.profile), username },
      updatedAt: now,
      attempts: 0,
    };
    writeQueue([...queue, operation], false);
    if (input.password) writeCreatePassword(operation.id, input.password);
    announceChange();
    return { operationId: operation.id };
  }

  if (input.kind === "upsert") {
    const username = normalizeUsername(input.username);
    removeDeletedUsername(username);
    const profile: ProfilePayload = { ...safeProfile(input.profile), username };

    const pendingCreate = queue.find(
      (operation): operation is QueuedCreate =>
        operation.kind === "create" &&
        (operation.localUserId === input.userId ||
          normalizeUsername(operation.username) === username),
    );
    if (pendingCreate) {
      const updated: QueuedCreate = {
        ...pendingCreate,
        username,
        email: String(profile.email || pendingCreate.email).trim().toLowerCase(),
        profile: { ...pendingCreate.profile, ...profile },
        updatedAt: now,
        lastError: undefined,
      };
      if (input.password) writeCreatePassword(updated.id, input.password);
      persistUpdatedOperation(queue, updated);
      return { operationId: updated.id };
    }

    const existing = queue.find(
      (operation): operation is QueuedUpsert =>
        operation.kind === "upsert" &&
        (operation.userId === input.userId ||
          normalizeUsername(operation.username) === username),
    );
    if (existing) {
      const updated: QueuedUpsert = {
        ...existing,
        username,
        profile: { ...existing.profile, ...profile },
        updatedAt: now,
        lastError: undefined,
      };
      if (input.password) writeCreatePassword(updated.id, input.password);
      persistUpdatedOperation(queue, updated);
      return { operationId: updated.id };
    }

    const operation: QueuedUpsert = {
      id: createId(),
      kind: "upsert",
      userId: input.userId,
      username,
      profile,
      updatedAt: now,
      attempts: 0,
    };
    writeQueue([...queue, operation], false);
    if (input.password) writeCreatePassword(operation.id, input.password);
    announceChange();
    return { operationId: operation.id };
  }

  addDeletedUsername(input.username);
  const pendingCreate = queue.find(
    (operation): operation is QueuedCreate =>
      operation.kind === "create" &&
      operationKeyMatches(operation, input.userId, input.username),
  );

  const targetUserId = pendingCreate?.cloudUserId || input.userId;
  const remaining = queue.filter((operation) => {
    if (pendingCreate && operation.id === pendingCreate.id) return false;
    if (operation.kind === "upsert" && operation.userId === targetUserId) return false;
    if (operation.kind === "delete" && operation.userId === targetUserId) return false;
    return true;
  });

  if (pendingCreate) {
    clearCreatePassword(pendingCreate.id);
  }

  const existingDelete = remaining.find(
    (operation): operation is QueuedDelete =>
      operation.kind === "delete" && operation.userId === targetUserId,
  );
  if (existingDelete) return { operationId: existingDelete.id };

  const operation: QueuedDelete = {
    id: createId(),
    kind: "delete",
    userId: targetUserId,
    username: normalizeUsername(input.username),
    updatedAt: now,
    attempts: 0,
  };
  writeQueue([...remaining, operation]);
  return { operationId: operation.id };
}

async function sendOperation(
  operation: QueuedChange,
): Promise<{ sentUpdatedAt: number; profile?: ProfilePayload; localUserId?: string }> {
  const hasSession = await authService.hasActiveSupabaseSession().catch(() => false);

  if (operation.kind === "delete") {
    addDeletedUsername(operation.username);
    erpStore.deleteUser(operation.userId);
    if (hasSession && !String(operation.userId).startsWith("u-")) {
      await authService.deleteUser(operation.userId).catch(() => undefined);
    }
    const pushed = await pushUsersDirectorySnapshotToSupabase();
    if (!pushed && !hasSession) {
      throw new Error("تعذر الاتصال بقاعدة البيانات لحفظ الحذف؛ سيتم إعادة المحاولة تلقائياً.");
    }
    return { sentUpdatedAt: operation.updatedAt };
  }

  if (operation.kind === "upsert") {
    const sentUpdatedAt = operation.updatedAt;
    removeDeletedUsername(operation.username);
    let confirmedProfile: ProfilePayload | undefined;

    if (hasSession && !String(operation.userId).startsWith("u-")) {
      try {
        const pendingPassword = readCreatePassword(operation.id);
        if (pendingPassword) {
          await authService.updateManagedUserPassword(operation.userId, pendingPassword);
          clearCreatePassword(operation.id);
        }
        confirmedProfile = await authService.saveManagedProfile({
          ...operation.profile,
          id: operation.userId,
          username: normalizeUsername(operation.profile.username || operation.username),
        });
      } catch (err) {
        console.warn("[UserSync] Direct profile RPC fallback to directory snapshot:", err);
      }
    }

    const pushed = await pushUsersDirectorySnapshotToSupabase();
    if (!pushed && !confirmedProfile) {
      throw new Error("تعذر الاتصال بقاعدة البيانات لمزامنة التعديلات؛ سيتم إعادة المحاولة تلقائياً.");
    }
    clearCreatePassword(operation.id);
    return { sentUpdatedAt, profile: confirmedProfile };
  }

  removeDeletedUsername(operation.username);
  const sentUpdatedAt = operation.updatedAt;
  let confirmedProfile: ProfilePayload | undefined;

  if (hasSession) {
    try {
      const localUser = erpStore
        .getUsers()
        .find(
          (u) =>
            u.id === operation.localUserId ||
            normalizeUsername(u.username) === normalizeUsername(operation.username),
        );
      const password = readCreatePassword(operation.id) || String(localUser?.password || "");
      if (password) {
        const created = await authService.createManagedUserAccount({
          email: operation.email,
          password,
          username: operation.username,
          full_name: operation.profile.full_name || operation.username,
          phone: operation.profile.phone || "",
          role: operation.profile.role || "cashier",
          permissions: operation.profile.permissions || {},
        });
        if (created?.profile?.id) {
          confirmedProfile = created.profile;
        }
      }
    } catch (err) {
      console.warn("[UserSync] Managed account RPC fallback to directory snapshot:", err);
    }
  }

  const pushed = await pushUsersDirectorySnapshotToSupabase();
  if (!pushed && !confirmedProfile) {
    throw new Error("تعذر الاتصال بقاعدة البيانات لمزامنة المستخدم الجديد؛ سيتم إعادة المحاولة تلقائياً.");
  }
  clearCreatePassword(operation.id);
  return {
    sentUpdatedAt,
    profile: confirmedProfile,
    localUserId: operation.localUserId,
  };
}

async function performSync(): Promise<UserSyncSummary> {
  let syncedCount = 0;
  let errorCount = 0;

  if (!isOnline()) {
    return { pendingCount: readQueue().length, syncedCount, errorCount };
  }

  const snapshot = readQueue();
  for (const entry of snapshot) {
    let current = readQueue().find((item) => item.id === entry.id);
    if (!current) continue;

    try {
      const result = await sendOperation(current);
      const afterSend = readQueue().find((item) => item.id === current?.id);
      if (!afterSend || afterSend.updatedAt !== result.sentUpdatedAt) {
        // A newer local edit arrived while this request was running; keep it queued.
        continue;
      }

      if (current.kind === "delete") {
        erpStore.deleteUser(current.userId);
      } else if (result.profile) {
        cacheConfirmedProfile(result.profile, result.localUserId);
      }

      writeQueue(readQueue().filter((item) => item.id !== current?.id));
      if (current.kind === "create" || current.kind === "upsert") {
        clearCreatePassword(current.id);
      }
      syncedCount += 1;
    } catch (error: any) {
      current = readQueue().find((item) => item.id === entry.id);
      if (current) {
        const updated = {
          ...current,
          attempts: (current.attempts || 0) + 1,
          lastError: String(error?.message || error || "تعذرت المزامنة"),
        } as QueuedChange;
        persistUpdatedOperation(readQueue(), updated);
      }
      errorCount += 1;
    }
  }

  const summary = {
    pendingCount: readQueue().length,
    syncedCount,
    errorCount,
  };
  announceChange();
  return summary;
}

export function syncPendingUserChanges(): Promise<UserSyncSummary> {
  if (activeSync) return activeSync;
  activeSync = performSync().finally(() => {
    activeSync = null;
  });
  return activeSync;
}

export async function syncUsersDirectoryWithDatabase(): Promise<{
  connected: boolean;
  users: SystemUser[];
  authUser: any;
}> {
  if (!isOnline()) {
    return { connected: false, users: erpStore.getUsers(), authUser: null };
  }

  try {
    // 1. Flush any pending local changes first
    await syncPendingUserChanges();

    // 2. Fetch both the global directory snapshot and any authenticated profiles
    const [snapshot, authUser] = await Promise.all([
      pullUsersDirectorySnapshotFromSupabase(),
      authService.getCurrentUser().catch(() => null),
    ]);

    let profileUsers: SystemUser[] = [];
    if (authUser?.id) {
      try {
        const profiles = (await authService.getUsers()) as any[];
        profileUsers = (profiles || [])
          .filter((p) => Boolean(p?.id && p?.username))
          .map(profileToUser);
      } catch {
        // ignore if profiles query fails
      }
    }

    const deletedSet = new Set([
      ...readDeletedUsernames(),
      ...(snapshot?.deletedUsernames || []),
    ]);

    if (snapshot && Array.isArray(snapshot.users) && snapshot.users.length > 0) {
      const byUsername = new Map<string, SystemUser>();
      for (const u of snapshot.users) {
        if (!u?.username) continue;
        const uname = normalizeUsername(u.username);
        if (deletedSet.has(uname)) continue;
        byUsername.set(uname, {
          ...u,
          username: uname,
          permissions: {
            ...(snapshot.userPermissions?.[uname] || {}),
            ...(u.permissions || {}),
          },
        });
      }
      for (const p of profileUsers) {
        const uname = normalizeUsername(p.username);
        if (!uname || deletedSet.has(uname)) continue;
        const existing = byUsername.get(uname);
        byUsername.set(uname, {
          ...existing,
          ...p,
          employee_code: (p as any).employee_code || existing?.employee_code,
          password: existing?.password || p.password,
          permissions: {
            ...(existing?.permissions || {}),
            ...(p.permissions || {}),
          },
        });
      }

      const mergedList = Array.from(byUsername.values());
      erpStore.replaceManagedUsers(mergedList, {
        authoritative: true,
        deletedUsernames: Array.from(deletedSet),
      });
      announceChange();
      return { connected: true, users: erpStore.getUsers(), authUser };
    }

    if (profileUsers.length > 0) {
      erpStore.replaceManagedUsers(profileUsers, {
        deletedUsernames: Array.from(deletedSet),
      });
    }

    // No snapshot existed in Supabase yet -> seed Supabase with current directory immediately
    const pushed = await pushUsersDirectorySnapshotToSupabase();
    announceChange();
    return { connected: pushed || Boolean(authUser?.id), users: erpStore.getUsers(), authUser };
  } catch (err) {
    console.warn("[UserSync] Error syncing users directory with database:", err);
    return { connected: false, users: erpStore.getUsers(), authUser: null };
  }
}

export async function queueUserChange(input: UserChangeInput): Promise<UserSyncResult> {
  const enqueued = enqueueChange(input);
  if (enqueued.noOp || !enqueued.operationId) {
    if (isOnline()) {
      await pushUsersDirectorySnapshotToSupabase();
    }
    return {
      synced: true,
      pending: false,
      pendingCount: readQueue().length,
    };
  }

  if (!isOnline()) {
    return {
      synced: false,
      pending: true,
      pendingCount: readQueue().length,
      error: "لا يوجد اتصال بالإنترنت حاليًا.",
    };
  }

  await syncPendingUserChanges();
  const pending = readQueue().find((operation) => operation.id === enqueued.operationId);
  return {
    synced: !pending,
    pending: !!pending,
    pendingCount: readQueue().length,
    error: pending?.lastError,
  };
}

export function getPendingUserSyncCount(): number {
  return readQueue().length;
}

export function hasPendingUserChange(userId: string, username: string): boolean {
  return readQueue().some((operation) => operationKeyMatches(operation, userId, username));
}

export function getPendingUserError(userId: string, username: string): string | undefined {
  return readQueue().find((operation) => operationKeyMatches(operation, userId, username))
    ?.lastError;
}

export function hasPendingUserCreate(userId: string): boolean {
  return readQueue().some(
    (operation) => operation.kind === "create" && operation.localUserId === userId,
  );
}

export function needsPasswordForPendingUserCreate(userId: string): boolean {
  const pendingCreate = readQueue().find(
    (operation): operation is QueuedCreate =>
      operation.kind === "create" && operation.localUserId === userId,
  );
  return !pendingCreate?.cloudUserId;
}

export function startUserSync(): () => void {
  if (!canUseBrowserStorage()) return () => {};
  const sync = () => {
    if (isOnline()) void syncUsersDirectoryWithDatabase();
    else announceChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === QUEUE_KEY) announceChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("online", sync);
  window.addEventListener("focus", sync);
  document.addEventListener("visibilitychange", sync);
  sync();

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("online", sync);
    window.removeEventListener("focus", sync);
    document.removeEventListener("visibilitychange", sync);
  };
}
