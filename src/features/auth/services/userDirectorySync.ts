import { authService } from "@/features/auth/services/authService";
import { erpStore, type SystemUser } from "@/shared/services/erpStore";

const QUEUE_KEY = "restocash_pending_user_sync_v1";
const SECRET_PREFIX = "restocash_pending_user_secret_v1:";
const CHANGE_EVENT = "restocash-user-sync-updated";

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
  const { id: _ignoredId, password: _ignoredPassword, ...safe } = profile || {};
  return safe;
}

function profileToUser(profile: ProfilePayload): SystemUser {
  return {
    id: String(profile.id),
    full_name: profile.full_name || profile.username || "",
    username: String(profile.username || "").trim().toLowerCase(),
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
    // Persist the queue before notification, but only wake the sync worker after the
    // session-scoped password is ready. The password itself never enters localStorage.
    writeQueue([...queue, operation], false);
    writeCreatePassword(operation.id, input.password);
    announceChange();
    return { operationId: operation.id };
  }

  if (input.kind === "upsert") {
    const username = normalizeUsername(input.username);
    const profile = { ...safeProfile(input.profile), username };

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
        profile: { ...pendingCreate.profile, ...profile },
        updatedAt: now,
        lastError: undefined,
      };
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
    writeQueue([...queue, operation]);
    return { operationId: operation.id };
  }

  const pendingCreate = queue.find(
    (operation): operation is QueuedCreate =>
      operation.kind === "create" &&
      operationKeyMatches(operation, input.userId, input.username),
  );

  if (pendingCreate && !pendingCreate.cloudUserId) {
    writeQueue(queue.filter((operation) => operation.id !== pendingCreate.id));
    clearCreatePassword(pendingCreate.id);
    return { operationId: null, noOp: true };
  }

  const targetUserId = pendingCreate?.cloudUserId || input.userId;
  const remaining = queue.filter((operation) => {
    if (pendingCreate && operation.id === pendingCreate.id) return false;
    if (operation.kind === "upsert" && operation.userId === targetUserId) return false;
    if (operation.kind === "delete" && operation.userId === targetUserId) return false;
    return true;
  });

  if (String(targetUserId).startsWith("u-")) {
    writeQueue(remaining);
    return { operationId: null, noOp: true };
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
  if (operation.kind === "delete") {
    await authService.deleteUser(operation.userId);
    return { sentUpdatedAt: operation.updatedAt };
  }

  if (operation.kind === "upsert") {
    const sentUpdatedAt = operation.updatedAt;
    const profile = await authService.upsertProfile({
      ...operation.profile,
      id: operation.userId,
      username: normalizeUsername(operation.profile.username || operation.username),
    });
    return { sentUpdatedAt, profile };
  }

  let cloudUserId = operation.cloudUserId;
  if (!cloudUserId) {
    const password = readCreatePassword(operation.id);
    if (!password) {
      throw new Error(
        "المستخدم محفوظ محليًا لكن كلمة المرور المؤقتة غير متاحة. افتح تعديل المستخدم وأدخل كلمة مروره لإكمال المزامنة.",
      );
    }

    const created = await authService.signUpNewUser(operation.email, password, {
      username: operation.username,
      full_name: operation.profile.full_name || operation.username,
      phone: operation.profile.phone || "",
      role: operation.profile.role || "cashier",
    });
    cloudUserId = created?.user?.id;
    if (!cloudUserId) {
      throw new Error(
        "لم تؤكد خدمة Auth إنشاء الحساب. سيظل الطلب معلّقًا للمحاولة مرة أخرى.",
      );
    }

    const latestQueue = readQueue();
    const latest = latestQueue.find(
      (item): item is QueuedCreate => item.id === operation.id && item.kind === "create",
    );
    if (latest) {
      persistUpdatedOperation(latestQueue, {
        ...latest,
        cloudUserId,
        lastError: undefined,
      });
    }
    clearCreatePassword(operation.id);
  }

  const latestQueue = readQueue();
  const latest = latestQueue.find(
    (item): item is QueuedCreate => item.id === operation.id && item.kind === "create",
  );
  const current = latest || operation;
  const sentUpdatedAt = current.updatedAt;
  const profile = await authService.upsertProfile({
    ...current.profile,
    id: cloudUserId,
    username: normalizeUsername(current.profile.username || current.username),
  });
  return { sentUpdatedAt, profile, localUserId: current.localUserId };
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
      if (current.kind === "create") clearCreatePassword(current.id);
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

export async function queueUserChange(input: UserChangeInput): Promise<UserSyncResult> {
  const enqueued = enqueueChange(input);
  if (enqueued.noOp || !enqueued.operationId) {
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

export function hasPendingUserCreate(userId: string): boolean {
  return readQueue().some(
    (operation) => operation.kind === "create" && operation.localUserId === userId,
  );
}

export function startUserSync(): () => void {
  if (!canUseBrowserStorage()) return () => {};
  const sync = () => {
    if (isOnline()) void syncPendingUserChanges();
    else announceChange();
  };
  window.addEventListener("online", sync);
  window.addEventListener("focus", sync);
  document.addEventListener("visibilitychange", sync);
  sync();

  return () => {
    window.removeEventListener("online", sync);
    window.removeEventListener("focus", sync);
    document.removeEventListener("visibilitychange", sync);
  };
}
