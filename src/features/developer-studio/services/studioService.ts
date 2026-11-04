/**
 * Developer Studio Pro — Persistence, Versioning, Conflict Detection & Atomic Publish Service
 * Integrates with Supabase tables:
 * - studio_published_configs
 * - studio_drafts
 * - studio_history
 * With strict server-confirmed saving and publishing (never simulates cloud success).
 */

import { supabase } from "@/integrations/supabase/client";
import {
  StudioPublishedConfig,
  StudioDraft,
  StudioHistoryRecord,
  ConflictDetail,
  CURRENT_SCHEMA_VERSION,
  validateDraftHierarchy,
  PageModel,
  ElementModel,
  StudioDomEdit,
  DEFAULT_STUDIO_DESIGN_SYSTEM,
  packDomEditsWithMeta,
  unpackDomEditsAndMeta,
  StudioNamedSnapshot,
  createStudioId,
} from "../models/studio.types";

const LOCAL_PUBLISHED_KEY = "restocash_studio_published_v1";
const LOCAL_DRAFT_KEY = "restocash_studio_draft_v1";
const LOCAL_HISTORY_KEY = "restocash_studio_history_v1";

export interface StudioAccessDiagnostics {
  authenticated: boolean;
  userId?: string;
  email?: string;
  profileFound: boolean;
  role?: string;
  developerOptions: boolean;
  allowed: boolean;
  reason: string;
}

export interface SaveDraftResult {
  success: boolean;
  updatedAt: string;
  serverUpdatedAt?: string;
  error?: string;
  conflict?: boolean;
  offline?: boolean;
}

export interface PublishDraftResult {
  success: boolean;
  newRevision: number;
  publishedAt?: string;
  error?: string;
  conflict?: boolean;
  offline?: boolean;
}

export function isNetworkOrOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  const msg = String((error as any)?.message || (error as any)?.details || error || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("offline") ||
    msg.includes("timeout") ||
    msg.includes("timed out")
  );
}

/**
 * Default Starter Configuration (Revision 1)
 */
export const DEFAULT_STARTER_CONFIG: StudioPublishedConfig = {
  id: "active",
  revision: 1,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  publishedBy: "system",
  publishedAt: "2026-10-14T00:00:00.000Z",
  summary: "التهيئة الأساسية لنظام استوديو المطور Pro",
  domEdits: {},
  designSystem: DEFAULT_STUDIO_DESIGN_SYSTEM,
  assets: [],
  reusableComponents: [],
  pages: {
    page_dashboard: {
      id: "page_dashboard",
      route: "/admin",
      name: "لوحة الأقسام الرئيسية",
      description: "الصفحة الرئيسية للوحة الإدارة والمحاسبة ERP",
      visibleInNav: true,
      elementIds: ["elem_banner_1", "elem_heading_1", "elem_stats_container"],
      styles: { paddingTop: "16px", paddingBottom: "16px" },
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: "2026-10-14T00:00:00.000Z",
      updatedBy: "system",
    },
    page_pos: {
      id: "page_pos",
      route: "/pos",
      name: "نقطة البيع والكاشير",
      description: "شاشة الكاشير والطلبات المباشرة",
      visibleInNav: true,
      elementIds: ["elem_pos_header"],
      styles: { paddingTop: "12px", paddingBottom: "12px" },
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: "2026-10-14T00:00:00.000Z",
      updatedBy: "system",
    },
  },
  elements: {
    elem_banner_1: {
      id: "elem_banner_1",
      pageId: "page_dashboard",
      parentId: null,
      type: "card",
      content: {
        title: "مرحباً بك في نظام Restocash ERP — الجيل المتقدم",
        subtitle: "Developer Studio Pro مفعّل",
        description: "يمكنك تخصيص كافة عناصر الصفحة وتغيير الألوان والخطوط والهوامش وحفظ المسودة ثم نشرها بأمان.",
        badgeText: "نشط",
        showHeader: true,
      },
      styles: {
        backgroundColor: "#ffffff",
        textColor: "#0f172a",
        borderColor: "#e2e8f0",
        borderWidth: "1px",
        borderStyle: "solid",
        borderRadius: "16px",
        paddingTop: "20px",
        paddingBottom: "20px",
        paddingLeft: "24px",
        paddingRight: "24px",
        marginBottom: "20px",
        boxShadow: "sm",
      },
      layout: { position: "static", order: 1, visibility: true },
      attributes: { "data-studio-id": "welcome-banner" },
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: "2026-10-14T00:00:00.000Z",
      updatedBy: "system",
    },
    elem_heading_1: {
      id: "elem_heading_1",
      pageId: "page_dashboard",
      parentId: null,
      type: "heading",
      content: {
        text: "الأقسام التشغيلية ومؤشرات الأداء",
        level: "h2",
      },
      styles: {
        textColor: "#1e293b",
        fontSize: "22px",
        fontWeight: "800",
        textAlign: "right",
        marginBottom: "14px",
      },
      layout: { position: "static", order: 2, visibility: true },
      attributes: {},
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: "2026-10-14T00:00:00.000Z",
      updatedBy: "system",
    },
    elem_stats_container: {
      id: "elem_stats_container",
      pageId: "page_dashboard",
      parentId: null,
      type: "container",
      content: {
        label: "حاوية البطاقات السريعة",
        direction: "row",
        wrap: true,
      },
      styles: {
        display: "flex",
        flexDirection: "row",
        gap: "16px",
        flexWrap: "wrap",
        paddingTop: "12px",
        paddingBottom: "12px",
        marginBottom: "16px",
      },
      layout: { position: "static", order: 3, visibility: true },
      attributes: {},
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: "2026-10-14T00:00:00.000Z",
      updatedBy: "system",
    },
    elem_btn_cta: {
      id: "elem_btn_cta",
      pageId: "page_dashboard",
      parentId: "elem_stats_container",
      type: "button",
      content: {
        label: "فتح تقارير المبيعات المباشرة",
        action: "link",
        url: "/admin/reports",
        variant: "default",
      },
      styles: {
        backgroundColor: "#4f46e5",
        textColor: "#ffffff",
        borderRadius: "10px",
        paddingTop: "10px",
        paddingBottom: "10px",
        paddingLeft: "18px",
        paddingRight: "18px",
        fontWeight: "700",
        fontSize: "14px",
      },
      layout: { position: "static", order: 1, visibility: true },
      attributes: {},
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: "2026-10-14T00:00:00.000Z",
      updatedBy: "system",
    },
    elem_pos_header: {
      id: "elem_pos_header",
      pageId: "page_pos",
      parentId: null,
      type: "heading",
      content: {
        text: "شاشة الكاشير السريع — Restocash POS",
        level: "h2",
      },
      styles: {
        textColor: "#0f172a",
        fontSize: "20px",
        fontWeight: "800",
        textAlign: "right",
        marginBottom: "12px",
      },
      layout: { position: "static", order: 1, visibility: true },
      attributes: {},
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: "2026-10-14T00:00:00.000Z",
      updatedBy: "system",
    },
  },
};

export const DEFAULT_STUDIO_PUBLISHED_CONFIG = DEFAULT_STARTER_CONFIG;

class StudioService {
  private inMemoryPublished: StudioPublishedConfig | null = null;
  private inMemoryDraft: StudioDraft | null = null;
  private inMemoryHistory: StudioHistoryRecord[] = [];

  constructor() {
    this.hydrateFromLocal();
  }

  private hydrateFromLocal() {
    if (typeof window === "undefined") return;
    try {
      const pubRaw = localStorage.getItem(LOCAL_PUBLISHED_KEY);
      if (pubRaw) {
        const parsed = JSON.parse(pubRaw);
        const unpacked = unpackDomEditsAndMeta(parsed.domEdits || parsed.dom_edits);
        this.inMemoryPublished = {
          ...parsed,
          domEdits: unpacked.domEdits,
          designSystem: parsed.designSystem || unpacked.designSystem,
          assets: parsed.assets || unpacked.assets,
          reusableComponents: parsed.reusableComponents || unpacked.reusableComponents,
        };
      } else {
        this.inMemoryPublished = JSON.parse(JSON.stringify(DEFAULT_STARTER_CONFIG));
      }

      const draftRaw = localStorage.getItem(LOCAL_DRAFT_KEY);
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        const unpacked = unpackDomEditsAndMeta(parsed.domEdits || parsed.dom_edits);
        this.inMemoryDraft = {
          ...parsed,
          domEdits: unpacked.domEdits,
          designSystem: parsed.designSystem || unpacked.designSystem,
          assets: parsed.assets || unpacked.assets,
          reusableComponents: parsed.reusableComponents || unpacked.reusableComponents,
          namedSnapshots: parsed.namedSnapshots || unpacked.namedSnapshots,
        };
      }

      const histRaw = localStorage.getItem(LOCAL_HISTORY_KEY);
      if (histRaw) {
        this.inMemoryHistory = JSON.parse(histRaw);
      } else {
        this.inMemoryHistory = [
          {
            id: 1,
            revision: 1,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            publishedBy: "system",
            publishedAt: DEFAULT_STARTER_CONFIG.publishedAt,
            summary: DEFAULT_STARTER_CONFIG.summary,
            snapshot: {
              pages: DEFAULT_STARTER_CONFIG.pages,
              elements: DEFAULT_STARTER_CONFIG.elements,
              domEdits: DEFAULT_STARTER_CONFIG.domEdits || {},
              designSystem: DEFAULT_STARTER_CONFIG.designSystem,
            },
          },
        ];
      }
    } catch {
      this.inMemoryPublished = JSON.parse(JSON.stringify(DEFAULT_STARTER_CONFIG));
    }
  }

  private async formatStudioSyncError(error: any, fallbackMessage: string): Promise<string> {
    const raw = String(error?.message || error?.details || error?.hint || fallbackMessage);
    if (isNetworkOrOfflineError(error)) {
      return `OFFLINE: تعذر الاتصال بخادم Supabase. تحقق من اتصال الإنترنت ثم أعد المحاولة. (${raw})`;
    }
    if (
      error?.code === "42501" ||
      /row-level security|permission denied|not_authorized|insufficient_privilege/i.test(raw)
    ) {
      const diagnostics = await this.getAccessStatus();
      if (!diagnostics.authenticated) {
        return "لا توجد جلسة Supabase مسجّلة حاليًا. سجّل الدخول بحساب مدير أولًا قبل الحفظ أو النشر.";
      }
      if (!diagnostics.profileFound) {
        return `الجلسة الحالية (${diagnostics.email || diagnostics.userId}) لا تملك صفًا في جدول public.profiles.`;
      }
      if (!diagnostics.allowed) {
        return (
          `الحساب الحالي (${diagnostics.email || diagnostics.userId}) بدور (${diagnostics.role || "غير محدد"}) ` +
          `لا يملك صلاحية developer_options أو دور admin/super_admin.`
        );
      }
      return `رفضت قاعدة البيانات العملية رغم التحقق من الصلاحية: ${raw}`;
    }
    return raw;
  }

  /**
   * Inspect how Supabase sees the current browser session and Studio permissions.
   */
  async getAccessStatus(): Promise<StudioAccessDiagnostics> {
    let sessionUser: { id?: string; email?: string } | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      sessionUser = data?.session?.user || null;
    } catch {
      sessionUser = null;
    }

    try {
      const { data, error } = await supabase.rpc("developer_studio_access_status" as any);
      if (!error && data && typeof data === "object") {
        const status = data as Record<string, any>;
        return {
          authenticated: Boolean(status.authenticated),
          userId: String(status.user_id || sessionUser?.id || ""),
          email: sessionUser?.email,
          profileFound: Boolean(status.profile_found),
          role: status.role ? String(status.role) : undefined,
          developerOptions: Boolean(status.developer_options),
          allowed: Boolean(status.allowed),
          reason: String(status.reason || "unknown"),
        };
      }
    } catch {
      // Fall back to session inspection below
    }

    return {
      authenticated: Boolean(sessionUser?.id),
      userId: sessionUser?.id,
      email: sessionUser?.email,
      profileFound: false,
      developerOptions: false,
      allowed: false,
      reason: sessionUser?.id ? "diagnostic_rpc_unavailable" : "no_authenticated_session",
    };
  }

  /**
   * Fetch the latest published configuration for the live application runtime.
   * Authoritative server data always wins when reachable.
   */
  async getPublishedConfig(): Promise<StudioPublishedConfig> {
    try {
      const config = await this.fetchRemotePublishedConfig();
      this.inMemoryPublished = config;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LOCAL_PUBLISHED_KEY, JSON.stringify(config));
        } catch {
          // ignore storage quota errors
        }
      }
      return config;
    } catch {
      // Fallback to in-memory or starter config only when offline/unreachable
    }

    if (!this.inMemoryPublished) {
      this.inMemoryPublished = JSON.parse(JSON.stringify(DEFAULT_STARTER_CONFIG));
    }
    return this.inMemoryPublished!;
  }

  /**
   * Read the authoritative published configuration from Supabase without silent fallback.
   */
  async fetchRemotePublishedConfig(): Promise<StudioPublishedConfig> {
    const { data, error } = (await supabase
      .from("studio_published_configs" as any)
      .select("*")
      .eq("id", "active")
      .maybeSingle()) as any;

    if (error) {
      throw new Error(await this.formatStudioSyncError(error, "تعذر قراءة النسخة المنشورة من Supabase."));
    }
    if (!data?.pages || !data?.elements) {
      return JSON.parse(JSON.stringify(DEFAULT_STARTER_CONFIG));
    }

    const unpacked = unpackDomEditsAndMeta(data.dom_edits);

    return {
      id: data.id,
      revision: Number(data.revision || 1),
      schemaVersion: Number(data.schema_version || CURRENT_SCHEMA_VERSION),
      schema_version: Number(data.schema_version || CURRENT_SCHEMA_VERSION),
      pages: data.pages,
      elements: data.elements,
      domEdits: unpacked.domEdits,
      designSystem: unpacked.designSystem,
      assets: unpacked.assets,
      reusableComponents: unpacked.reusableComponents,
      publishedBy: data.published_by || "admin",
      publishedAt: data.published_at || new Date().toISOString(),
      summary: data.summary || "",
    };
  }

  /**
   * Adopt a published configuration received from Supabase Realtime.
   */
  acceptRealtimePublishedConfig(config: StudioPublishedConfig): void {
    const unpacked = unpackDomEditsAndMeta(config.domEdits as any);
    const normalized: StudioPublishedConfig = {
      ...config,
      domEdits: unpacked.domEdits,
      designSystem: config.designSystem || unpacked.designSystem,
      assets: config.assets || unpacked.assets,
      reusableComponents: config.reusableComponents || unpacked.reusableComponents,
    };
    this.inMemoryPublished = normalized;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCAL_PUBLISHED_KEY, JSON.stringify(normalized));
      } catch {
        // cache is best-effort
      }
      window.dispatchEvent(new CustomEvent("studio_published_updated", { detail: normalized }));
    }
  }

  /**
   * Read the last server-confirmed draft without local unsaved overrides (for Diff comparison).
   */
  async getServerSavedDraft(owner = "admin"): Promise<StudioDraft | null> {
    try {
      const { data, error } = (await supabase
        .from("studio_drafts" as any)
        .select("*")
        .eq("owner", owner)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()) as any;

      if (!error && data && data.pages) {
        const unpacked = unpackDomEditsAndMeta(data.dom_edits);
        return {
          id: data.id,
          owner: data.owner || owner,
          baseRevision: Number(data.base_revision || 1),
          schemaVersion: Number(data.schema_version || CURRENT_SCHEMA_VERSION),
          pages: data.pages,
          elements: data.elements || {},
          domEdits: unpacked.domEdits,
          designSystem: unpacked.designSystem,
          assets: unpacked.assets,
          reusableComponents: unpacked.reusableComponents,
          namedSnapshots: unpacked.namedSnapshots,
          updatedAt: data.updated_at,
          serverUpdatedAt: data.updated_at,
          createdAt: data.created_at,
          hasUnpublishedChanges: true,
          hasUnsavedLocalChanges: false,
        };
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Load or initialize an editable draft for the Studio workspace.
   * Preserves unsaved local recovery drafts if they are newer than the server row.
   */
  async getDraft(owner = "admin"): Promise<StudioDraft> {
    const localRecovery = this.inMemoryDraft?.hasUnsavedLocalChanges ? this.inMemoryDraft : null;

    try {
      const { data, error } = (await supabase
        .from("studio_drafts" as any)
        .select("*")
        .eq("owner", owner)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()) as any;

      if (!error && data && data.pages) {
        const unpacked = unpackDomEditsAndMeta(data.dom_edits);
        const serverDraft: StudioDraft = {
          id: data.id,
          owner: data.owner || owner,
          baseRevision: Number(data.base_revision || 1),
          schemaVersion: Number(data.schema_version || CURRENT_SCHEMA_VERSION),
          pages: data.pages,
          elements: data.elements || {},
          domEdits: unpacked.domEdits,
          designSystem: unpacked.designSystem,
          assets: unpacked.assets,
          reusableComponents: unpacked.reusableComponents,
          namedSnapshots: unpacked.namedSnapshots,
          updatedAt: data.updated_at,
          serverUpdatedAt: data.updated_at,
          createdAt: data.created_at,
          hasUnpublishedChanges: true,
          hasUnsavedLocalChanges: false,
        };

        if (localRecovery) {
          const localTime = Date.parse(localRecovery.updatedAt || "");
          const serverTime = Date.parse(serverDraft.updatedAt || "");
          if (!Number.isNaN(localTime) && !Number.isNaN(serverTime) && localTime > serverTime) {
            const recovered: StudioDraft = {
              ...localRecovery,
              id: serverDraft.id,
              serverUpdatedAt: serverDraft.updatedAt,
              hasUnsavedLocalChanges: true,
              hasUnpublishedChanges: true,
            };
            this.inMemoryDraft = recovered;
            this.persistLocalDraft(recovered);
            return recovered;
          }
        }

        this.inMemoryDraft = serverDraft;
        this.persistLocalDraft(serverDraft);
        return serverDraft;
      }
    } catch {
      // Fall back to local draft or published baseline below
    }

    if (localRecovery) {
      return localRecovery;
    }

    if (this.inMemoryDraft && !this.inMemoryDraft.hasUnsavedLocalChanges) {
      return {
        ...this.inMemoryDraft,
        domEdits: this.inMemoryDraft.domEdits || {},
        designSystem: this.inMemoryDraft.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM,
      };
    }

    const published = await this.getPublishedConfig();
    const freshDraft: StudioDraft = {
      id: "draft_" + owner,
      owner,
      baseRevision: published.revision,
      schemaVersion: published.schemaVersion || published.schema_version || CURRENT_SCHEMA_VERSION,
      pages: JSON.parse(JSON.stringify(published.pages)),
      elements: JSON.parse(JSON.stringify(published.elements)),
      domEdits: JSON.parse(JSON.stringify(published.domEdits || {})),
      designSystem: JSON.parse(JSON.stringify(published.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM)),
      assets: JSON.parse(JSON.stringify(published.assets || [])),
      reusableComponents: JSON.parse(JSON.stringify(published.reusableComponents || [])),
      namedSnapshots: [],
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      hasUnpublishedChanges: false,
      hasUnsavedLocalChanges: false,
    };

    this.inMemoryDraft = freshDraft;
    this.persistLocalDraft(freshDraft);
    return freshDraft;
  }

  /**
   * Save draft changes to Supabase.
   * NEVER reports `success: true` or sets `hasUnsavedLocalChanges: false` unless Supabase
   * explicitly confirms the write with a valid server timestamp.
   */
  async saveDraft(draft: StudioDraft): Promise<SaveDraftResult> {
    const updatedAt = new Date().toISOString();
    const updatedDraft: StudioDraft = {
      ...draft,
      domEdits: draft.domEdits || {},
      designSystem: draft.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM,
      assets: draft.assets || [],
      reusableComponents: draft.reusableComponents || [],
      namedSnapshots: draft.namedSnapshots || [],
      updatedAt,
      hasUnpublishedChanges: true,
      hasUnsavedLocalChanges: true,
    };

    const contentKey = (value: StudioDraft | null) =>
      value
        ? JSON.stringify([
            value.baseRevision,
            value.pages || {},
            value.elements || {},
            value.domEdits || {},
            value.designSystem || {},
            value.assets || [],
            value.reusableComponents || [],
          ])
        : "";

    const submittedKey = contentKey(updatedDraft);

    const hasNewerLocalChanges = (current: StudioDraft | null): boolean =>
      !!current &&
      current.hasUnsavedLocalChanges === true &&
      contentKey(current) !== submittedKey;

    // Stage recovery copy locally first
    this.inMemoryDraft = updatedDraft;
    this.persistLocalDraft(updatedDraft);

    const packedDomEdits = packDomEditsWithMeta(updatedDraft);

    try {
      const { data, error } = (await supabase.rpc("developer_studio_save_draft" as any, {
        p_owner: updatedDraft.owner,
        p_draft_id: updatedDraft.id || "draft_" + updatedDraft.owner,
        p_expected_updated_at: updatedDraft.serverUpdatedAt || null,
        p_base_revision: updatedDraft.baseRevision,
        p_schema_version: updatedDraft.schemaVersion,
        p_pages: updatedDraft.pages,
        p_elements: updatedDraft.elements,
        p_dom_edits: packedDomEdits,
      } as any)) as any;

      if (error) throw error;

      const saved = data as Record<string, any> | null;
      if (!saved || saved.success !== true) {
        const isConflict = Boolean(saved?.conflict);
        const serverTs = saved?.serverUpdatedAt ? String(saved.serverUpdatedAt) : undefined;
        const errMsg =
          saved?.error ||
          (isConflict
            ? "تغيرت المسودة على الخادم من جلسة أخرى. احتفظنا بتعديلاتك محليًا ولم تتم الكتابة فوقها."
            : "لم يؤكد Supabase حفظ المسودة؛ بقيت النسخة المحلية غير متزامنة.");

        // Keep local draft marked unsaved
        return {
          success: false,
          updatedAt,
          serverUpdatedAt: serverTs,
          conflict: isConflict,
          offline: false,
          error: String(errMsg),
        };
      }

      const rawServerTimestamp = String(saved.serverUpdatedAt || saved.updatedAt || saved.updated_at || "");
      if (!rawServerTimestamp || Number.isNaN(Date.parse(rawServerTimestamp))) {
        return {
          success: false,
          updatedAt,
          error: "لم يُرجع الخادم طابعًا زمنيًا صالحًا لتأكيد حفظ المسودة.",
        };
      }

      const confirmedDraft: StudioDraft = {
        ...updatedDraft,
        id: String(saved.id || updatedDraft.id),
        updatedAt: rawServerTimestamp,
        serverUpdatedAt: rawServerTimestamp,
        hasUnsavedLocalChanges: false,
      };

      if (!hasNewerLocalChanges(this.inMemoryDraft)) {
        this.inMemoryDraft = confirmedDraft;
        this.persistLocalDraft(confirmedDraft);
      }

      return {
        success: true,
        updatedAt: confirmedDraft.updatedAt,
        serverUpdatedAt: confirmedDraft.serverUpdatedAt,
      };
    } catch (e: any) {
      const raw = String(e?.message || e?.details || "تعذر تأكيد حفظ المسودة على الخادم.");

      // Only attempt direct table fallback if the RPC function execute grant is missing
      if (/permission denied for function developer_studio_save_draft/i.test(raw)) {
        try {
          const nowIso = new Date().toISOString();
          const payload = {
            base_revision: updatedDraft.baseRevision,
            schema_version: updatedDraft.schemaVersion,
            pages: updatedDraft.pages,
            elements: updatedDraft.elements,
            dom_edits: packedDomEdits,
            updated_at: nowIso,
          };
          let savedRow: any = null;
          if (updatedDraft.serverUpdatedAt) {
            const { data, error: directError } = (await supabase
              .from("studio_drafts" as any)
              .update(payload as any)
              .eq("owner", updatedDraft.owner)
              .eq("updated_at", updatedDraft.serverUpdatedAt)
              .select("id, updated_at")
              .maybeSingle()) as any;
            if (directError) throw directError;
            if (!data) {
              return {
                success: false,
                updatedAt,
                conflict: true,
                error: "تغيرت المسودة على الخادم أثناء الحفظ؛ أعد فحص التوافق قبل المحاولة.",
              };
            }
            savedRow = data;
          } else {
            const { data, error: directError } = (await supabase
              .from("studio_drafts" as any)
              .insert({
                id: updatedDraft.id || "draft_" + updatedDraft.owner,
                owner: updatedDraft.owner,
                ...payload,
                created_at: nowIso,
              } as any)
              .select("id, updated_at")
              .maybeSingle()) as any;
            if (directError) throw directError;
            if (!data) {
              return {
                success: false,
                updatedAt,
                error: "لم يؤكد الخادم إنشاء المسودة الجديدة.",
              };
            }
            savedRow = data;
          }

          const confirmedAt = String(savedRow.updated_at || "");
          if (!confirmedAt || Number.isNaN(Date.parse(confirmedAt))) {
            return {
              success: false,
              updatedAt,
              error: "لم يُرجع الخادم طابعًا زمنيًا صالحًا للمسودة المحفوظة.",
            };
          }

          const confirmedDraft: StudioDraft = {
            ...updatedDraft,
            id: String(savedRow.id || updatedDraft.id),
            updatedAt: confirmedAt,
            serverUpdatedAt: confirmedAt,
            hasUnsavedLocalChanges: false,
          };
          if (!hasNewerLocalChanges(this.inMemoryDraft)) {
            this.inMemoryDraft = confirmedDraft;
            this.persistLocalDraft(confirmedDraft);
          }
          return {
            success: true,
            updatedAt: confirmedAt,
            serverUpdatedAt: confirmedAt,
          };
        } catch (fallbackError: any) {
          const offline = isNetworkOrOfflineError(fallbackError);
          const formatted = await this.formatStudioSyncError(
            fallbackError,
            "فشل حفظ المسودة على Supabase.",
          );
          return {
            success: false,
            updatedAt,
            offline,
            error: formatted,
          };
        }
      }

      const offline = isNetworkOrOfflineError(e);
      const formatted = await this.formatStudioSyncError(e, "فشل حفظ المسودة على Supabase.");
      // Preserve unsaved local draft — NEVER report Saved when Supabase fails!
      if (!hasNewerLocalChanges(this.inMemoryDraft)) {
        this.inMemoryDraft = updatedDraft;
        this.persistLocalDraft(updatedDraft);
      }
      return {
        success: false,
        updatedAt,
        offline,
        error: formatted,
      };
    }
  }

  /**
   * Confirm the shared draft has not been changed by another browser/session.
   * Never reports `compatible: true` if the server check fails!
   */
  async checkDraftSyncCompatibility(draft: StudioDraft): Promise<{
    compatible: boolean;
    serverUpdatedAt?: string;
    needsRebase?: boolean;
    serverDraft?: StudioDraft;
    message?: string;
    error?: string;
    offline?: boolean;
    conflict?: boolean;
  }> {
    try {
      const { data, error } = (await supabase.rpc("developer_studio_check_draft_sync" as any, {
        p_owner: draft.owner,
        p_expected_updated_at: draft.serverUpdatedAt || null,
      } as any)) as any;
      if (error) throw error;

      const result = data as Record<string, any> | null;
      if (!result) {
        return {
          compatible: false,
          error: "Supabase لم يُرجع نتيجة لفحص توافق المسودة؛ لم تتم المزامنة.",
        };
      }
      const serverDraftData = result.serverDraft;
      const unpacked = serverDraftData ? unpackDomEditsAndMeta(serverDraftData.domEdits) : null;
      const serverDraft: StudioDraft | undefined =
        serverDraftData && unpacked
          ? {
              id: String(serverDraftData.id || "draft_" + draft.owner),
              owner: String(serverDraftData.owner || draft.owner),
              baseRevision: Number(serverDraftData.baseRevision || 1),
              schemaVersion: Number(serverDraftData.schemaVersion || CURRENT_SCHEMA_VERSION),
              pages: serverDraftData.pages || {},
              elements: serverDraftData.elements || {},
              domEdits: unpacked.domEdits,
              designSystem: unpacked.designSystem,
              assets: unpacked.assets,
              reusableComponents: unpacked.reusableComponents,
              namedSnapshots: unpacked.namedSnapshots,
              updatedAt: String(
                serverDraftData.updatedAt || result.serverUpdatedAt || new Date().toISOString(),
              ),
              serverUpdatedAt: String(
                serverDraftData.serverUpdatedAt || result.serverUpdatedAt || "",
              ),
              createdAt: String(
                serverDraftData.createdAt || serverDraftData.updatedAt || new Date().toISOString(),
              ),
              hasUnpublishedChanges: true,
              hasUnsavedLocalChanges: false,
            }
          : undefined;

      const isCompatible = result.compatible === true;
      return {
        compatible: isCompatible,
        conflict: !isCompatible && Boolean(result.exists),
        serverUpdatedAt: result.serverUpdatedAt ? String(result.serverUpdatedAt) : undefined,
        needsRebase: result.needsRebase === true,
        serverDraft,
        message: result.message ? String(result.message) : undefined,
        error: result.error ? String(result.error) : undefined,
      };
    } catch (error: any) {
      const raw = String(error?.message || error?.details || "تعذر فحص توافق المسودة.");
      if (/permission denied for function developer_studio_check_draft_sync/i.test(raw)) {
        try {
          const { data, error: fallbackError } = (await supabase
            .from("studio_drafts" as any)
            .select("*")
            .eq("owner", draft.owner)
            .maybeSingle()) as any;
          if (fallbackError) throw fallbackError;

          if (!data) {
            return draft.serverUpdatedAt
              ? {
                  compatible: false,
                  conflict: true,
                  error:
                    "لم تعد المسودة السحابية موجودة؛ احتفظنا بالنسخة المحلية ولم نكتب فوق أي نسخة.",
                }
              : {
                  compatible: true,
                  needsRebase: false,
                  message: "لا توجد مسودة بعيدة؛ يمكن إنشاء أول نسخة محفوظة.",
                };
          }

          const serverUpdatedAt = String(data.updated_at || "");
          const unpacked = unpackDomEditsAndMeta(data.dom_edits);
          const serverDraft: StudioDraft = {
            id: String(data.id || "draft_" + draft.owner),
            owner: String(data.owner || draft.owner),
            baseRevision: Number(data.base_revision || 1),
            schemaVersion: Number(data.schema_version || CURRENT_SCHEMA_VERSION),
            pages: data.pages || {},
            elements: data.elements || {},
            domEdits: unpacked.domEdits,
            designSystem: unpacked.designSystem,
            assets: unpacked.assets,
            reusableComponents: unpacked.reusableComponents,
            namedSnapshots: unpacked.namedSnapshots,
            updatedAt: serverUpdatedAt || new Date().toISOString(),
            serverUpdatedAt,
            createdAt: String(data.created_at || serverUpdatedAt || new Date().toISOString()),
            hasUnpublishedChanges: true,
            hasUnsavedLocalChanges: false,
          };

          if (!draft.serverUpdatedAt) {
            return {
              compatible: true,
              needsRebase: true,
              serverUpdatedAt,
              serverDraft,
              message: "تمت قراءة المسودة المحفوظة؛ ستُدمج تعديلاتك محليًا قبل الحفظ.",
            };
          }
          if (Date.parse(serverUpdatedAt) !== Date.parse(draft.serverUpdatedAt)) {
            return {
              compatible: false,
              conflict: true,
              serverUpdatedAt,
              serverDraft,
              error:
                "تغيرت المسودة السحابية من جلسة أخرى. احتفظنا بتعديلاتك المحلية ولم نستبدل النسخة البعيدة.",
            };
          }
          return { compatible: true, needsRebase: false, serverUpdatedAt };
        } catch (fallbackError: any) {
          const offline = isNetworkOrOfflineError(fallbackError);
          return {
            compatible: false,
            offline,
            error: await this.formatStudioSyncError(
              fallbackError,
              "تعذر التحقق من توافق المسودة مع الخادم.",
            ),
          };
        }
      }

      const offline = isNetworkOrOfflineError(error);
      return {
        compatible: false,
        offline,
        error: await this.formatStudioSyncError(error, "تعذر التحقق من توافق المسودة مع الخادم."),
      };
    }
  }

  /**
   * Discard unsaved local draft changes and restore the last server-saved draft (or published baseline).
   */
  async discardDraft(owner = "admin"): Promise<StudioDraft> {
    const { data, error } = (await supabase
      .from("studio_drafts" as any)
      .select("*")
      .eq("owner", owner)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as any;

    if (error) {
      throw new Error(
        "تعذر تحميل آخر مسودة محفوظة من Supabase؛ لم يتم إلغاء التعديلات: " + error.message,
      );
    }

    let freshDraft: StudioDraft;
    if (data?.pages && data?.elements) {
      const unpacked = unpackDomEditsAndMeta(data.dom_edits);
      freshDraft = {
        id: data.id || "draft_" + owner,
        owner: data.owner || owner,
        baseRevision: Number(data.base_revision || 1),
        schemaVersion: Number(data.schema_version || CURRENT_SCHEMA_VERSION),
        pages: data.pages || {},
        elements: data.elements || {},
        domEdits: unpacked.domEdits,
        designSystem: unpacked.designSystem,
        assets: unpacked.assets,
        reusableComponents: unpacked.reusableComponents,
        namedSnapshots: unpacked.namedSnapshots,
        updatedAt: data.updated_at || new Date().toISOString(),
        createdAt: data.created_at || data.updated_at || new Date().toISOString(),
        serverUpdatedAt: data.updated_at || undefined,
        hasUnpublishedChanges: true,
        hasUnsavedLocalChanges: false,
      };
    } else {
      const published = await this.fetchRemotePublishedConfig();
      freshDraft = {
        id: "draft_" + owner,
        owner,
        baseRevision: published.revision,
        schemaVersion:
          published.schemaVersion || published.schema_version || CURRENT_SCHEMA_VERSION,
        pages: JSON.parse(JSON.stringify(published.pages || {})),
        elements: JSON.parse(JSON.stringify(published.elements || {})),
        domEdits: JSON.parse(JSON.stringify(published.domEdits || {})),
        designSystem: JSON.parse(
          JSON.stringify(published.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM),
        ),
        assets: JSON.parse(JSON.stringify(published.assets || [])),
        reusableComponents: JSON.parse(JSON.stringify(published.reusableComponents || [])),
        namedSnapshots: [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        hasUnpublishedChanges: false,
        hasUnsavedLocalChanges: false,
      };
    }

    this.inMemoryDraft = freshDraft;
    this.persistLocalDraft(freshDraft);
    return freshDraft;
  }

  /**
   * Explicitly discard the saved draft and load the latest published version.
   */
  async reloadLatestPublishedDraft(owner = "admin"): Promise<StudioDraft> {
    const published = await this.fetchRemotePublishedConfig();
    const { error } = await supabase
      .from("studio_drafts" as any)
      .delete()
      .eq("owner", owner);
    if (error) {
      throw new Error(
        "تعذر حذف المسودة القديمة من Supabase؛ لم يتم تحميل أحدث نسخة: " + error.message,
      );
    }

    const freshDraft: StudioDraft = {
      id: "draft_" + owner,
      owner,
      baseRevision: published.revision,
      schemaVersion: published.schemaVersion || published.schema_version || CURRENT_SCHEMA_VERSION,
      pages: JSON.parse(JSON.stringify(published.pages || {})),
      elements: JSON.parse(JSON.stringify(published.elements || {})),
      domEdits: JSON.parse(JSON.stringify(published.domEdits || {})),
      designSystem: JSON.parse(
        JSON.stringify(published.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM),
      ),
      assets: JSON.parse(JSON.stringify(published.assets || [])),
      reusableComponents: JSON.parse(JSON.stringify(published.reusableComponents || [])),
      namedSnapshots: [],
      updatedAt: published.publishedAt || new Date().toISOString(),
      createdAt: published.publishedAt || new Date().toISOString(),
      hasUnpublishedChanges: false,
      hasUnsavedLocalChanges: false,
    };

    this.inMemoryDraft = freshDraft;
    this.persistLocalDraft(freshDraft);
    return freshDraft;
  }

  /**
   * Check for optimistic concurrency conflicts against the authoritative remote published config.
   */
  async checkConflicts(draft: StudioDraft): Promise<{
    hasConflict: boolean;
    serverRevision: number;
    conflicts: ConflictDetail[];
    error?: string;
    offline?: boolean;
  }> {
    let latestPublished: StudioPublishedConfig;
    try {
      latestPublished = await this.fetchRemotePublishedConfig();
    } catch (err: any) {
      return {
        hasConflict: false,
        serverRevision: draft.baseRevision,
        conflicts: [],
        offline: isNetworkOrOfflineError(err),
        error: await this.formatStudioSyncError(
          err,
          "تعذر الاتصال بالخادم للتحقق من الإصدار المنشور الحالي.",
        ),
      };
    }

    const conflicts: ConflictDetail[] = [];

    if (draft.baseRevision === latestPublished.revision) {
      return {
        hasConflict: false,
        serverRevision: latestPublished.revision,
        conflicts: [],
      };
    }

    conflicts.push({
      type: "revision_gap",
      targetId: "system",
      title: "تعارض في رقم الإصدار",
      localValue: draft.baseRevision,
      serverValue: latestPublished.revision,
      description: `تم نشر إصدار أحدث (رقم ${latestPublished.revision}) بواسطة مستخدم آخر منذ بدء جلسة التعديل الحالية (التي تستند إلى الإصدار ${draft.baseRevision}).`,
    });

    Object.keys(draft.pages).forEach((pageId) => {
      const serverPage = latestPublished.pages[pageId];
      const localPage = draft.pages[pageId];
      if (!serverPage) {
        conflicts.push({
          type: "page_modified",
          targetId: pageId,
          title: `الصفحة: ${localPage.name}`,
          localValue: localPage,
          serverValue: null,
          description: "تم حذف أو تعديل هذه الصفحة على الخادم في الإصدار الجديد.",
        });
      } else if (serverPage.revision > draft.baseRevision) {
        conflicts.push({
          type: "page_modified",
          targetId: pageId,
          title: `الصفحة: ${localPage.name}`,
          localValue: localPage,
          serverValue: serverPage,
          description: `قام مستخدم آخر بتعديل بيانات وتنسيقات هذه الصفحة في الإصدار ${serverPage.revision}.`,
        });
      }
    });

    Object.keys(draft.elements).forEach((elemId) => {
      const serverElem = latestPublished.elements[elemId];
      const localElem = draft.elements[elemId];
      if (serverElem && serverElem.revision > draft.baseRevision) {
        conflicts.push({
          type: "element_modified",
          targetId: elemId,
          title: `عنصر #${elemId} (${localElem.type})`,
          localValue: localElem,
          serverValue: serverElem,
          description: `تم تعديل هذا العنصر على الخادم في الإصدار ${serverElem.revision}.`,
        });
      }
    });

    return {
      hasConflict: true,
      serverRevision: latestPublished.revision,
      conflicts,
    };
  }

  /**
   * Merge non-conflicting changes from latest published server version into local draft
   */
  async mergeWithLatest(draft: StudioDraft): Promise<StudioDraft> {
    const latest = await this.fetchRemotePublishedConfig();
    if (draft.baseRevision > latest.revision) {
      throw new Error(
        "الإصدار المرجعي للمسودة أحدث من الإصدار المنشور على الخادم؛ أعد تحميل المسودة قبل الدمج.",
      );
    }

    let baseSnapshot: {
      pages: Record<string, PageModel>;
      elements: Record<string, ElementModel>;
      domEdits?: Record<string, StudioDomEdit>;
    };
    if (draft.baseRevision === latest.revision) {
      baseSnapshot = {
        pages: latest.pages,
        elements: latest.elements,
        domEdits: latest.domEdits || {},
      };
    } else {
      const history = await this.getHistory();
      const baseRecord = history.find((record) => record.revision === draft.baseRevision);
      if (!baseRecord?.snapshot?.pages || !baseRecord.snapshot.elements) {
        throw new Error(
          "تعذر العثور على لقطة الإصدار الأصلي للمسودة؛ أوقفنا الدمج كي لا نكتب فوق تعديلات مستخدم آخر. " +
            "استخدم المقارنة اليدوية أو استعد أحدث نسخة بعد حفظ نسخة من تعديلاتك المحلية.",
        );
      }
      baseSnapshot = baseRecord.snapshot;
    }

    const conflicts: string[] = [];
    const stableValue = (value: any): string => {
      if (value === undefined) return "__studio_undefined__";
      if (value === null || typeof value !== "object") return JSON.stringify(value) ?? String(value);
      if (Array.isArray(value)) return "[" + value.map(stableValue).join(",") + "]";
      return (
        "{" +
        Object.keys(value)
          .sort()
          .map((key) => JSON.stringify(key) + ":" + stableValue(value[key]))
          .join(",") +
        "}"
      );
    };
    const sameValue = (left: any, right: any) => stableValue(left) === stableValue(right);
    const isRecord = (value: any): value is Record<string, any> =>
      !!value && typeof value === "object" && !Array.isArray(value);
    const stripEntityMetadata = (value: any) => {
      if (!isRecord(value)) return value;
      const { revision: _revision, updatedAt: _updatedAt, updatedBy: _updatedBy, ...data } = value;
      return data;
    };

    const mergeValue = (base: any, local: any, remote: any, path: string): any => {
      if (sameValue(local, base)) return remote;
      if (sameValue(remote, base)) return local;
      if (sameValue(local, remote)) return local;

      if (
        path.endsWith(".elementIds") &&
        Array.isArray(base) &&
        Array.isArray(local) &&
        Array.isArray(remote)
      ) {
        const baseSet = new Set(base);
        const localSet = new Set(local);
        const remoteSet = new Set(remote);
        const baseKeptInLocalOrder = local.filter((id) => baseSet.has(id));
        const baseKeptInRemoteOrder = remote.filter((id) => baseSet.has(id));
        const baseInLocalOrder = base.filter((id) => localSet.has(id));
        const baseInRemoteOrder = base.filter((id) => remoteSet.has(id));
        const localReordered = !sameValue(baseKeptInLocalOrder, baseInLocalOrder);
        const remoteReordered = !sameValue(baseKeptInRemoteOrder, baseInRemoteOrder);
        if (
          localReordered &&
          remoteReordered &&
          !sameValue(
            baseKeptInLocalOrder.filter((id) => remoteSet.has(id)),
            baseKeptInRemoteOrder.filter((id) => localSet.has(id)),
          )
        ) {
          conflicts.push(path + " (تعارض ترتيب العناصر)");
          return remote;
        }

        const keptBaseIds = base.filter((id) => localSet.has(id) && remoteSet.has(id));
        const localAddedIds = local.filter((id) => !baseSet.has(id));
        const remoteAddedIds = remote.filter((id) => !baseSet.has(id));
        const allowed = new Set([...keptBaseIds, ...localAddedIds, ...remoteAddedIds]);
        const preferredOrder = localReordered && !remoteReordered ? local : remote;
        const merged = preferredOrder.filter((id) => allowed.has(id));
        for (const id of [...remoteAddedIds, ...localAddedIds, ...keptBaseIds]) {
          if (!merged.includes(id)) merged.push(id);
        }
        return merged;
      }

      if (isRecord(base) && isRecord(local) && isRecord(remote)) {
        const merged: Record<string, any> = {};
        const keys = new Set([
          ...Object.keys(base),
          ...Object.keys(local),
          ...Object.keys(remote),
        ]);
        for (const key of keys) {
          const value = mergeValue(base[key], local[key], remote[key], path + "." + key);
          if (value !== undefined) merged[key] = value;
        }
        return merged;
      }

      conflicts.push(path);
      return remote;
    };

    const mergeMap = <T extends Record<string, any>>(
      label: string,
      baseMap: Record<string, T>,
      localMap: Record<string, T>,
      remoteMap: Record<string, T>,
      versionedEntities: boolean,
    ): Record<string, T> => {
      const result: Record<string, T> = {};
      const keys = new Set([
        ...Object.keys(baseMap || {}),
        ...Object.keys(localMap || {}),
        ...Object.keys(remoteMap || {}),
      ]);
      for (const id of keys) {
        const base = baseMap?.[id];
        const local = localMap?.[id];
        const remote = remoteMap?.[id];
        const comparableBase = versionedEntities ? stripEntityMetadata(base) : base;
        const comparableLocal = versionedEntities ? stripEntityMetadata(local) : local;
        const comparableRemote = versionedEntities ? stripEntityMetadata(remote) : remote;
        const path = label + "[" + id + "]";

        if (base === undefined) {
          if (local !== undefined && remote !== undefined) {
            if (!sameValue(comparableLocal, comparableRemote)) {
              conflicts.push(path + " (معرّف جديد متعارض)");
            }
            result[id] = remote;
          } else if (local !== undefined) {
            result[id] = local;
          } else if (remote !== undefined) {
            result[id] = remote;
          }
          continue;
        }

        if (local === undefined && remote === undefined) continue;
        if (local === undefined) {
          if (!sameValue(comparableRemote, comparableBase)) {
            conflicts.push(path + " (حذف محلي مقابل تعديل بعيد)");
            result[id] = remote as T;
          }
          continue;
        }
        if (remote === undefined) {
          if (!sameValue(comparableLocal, comparableBase)) {
            conflicts.push(path + " (تعديل محلي مقابل حذف بعيد)");
          }
          continue;
        }

        const mergedData = mergeValue(comparableBase, comparableLocal, comparableRemote, path);
        result[id] = versionedEntities
          ? ({
              ...(remote as T),
              ...(mergedData as T),
              revision: (remote as any).revision,
              updatedAt: (local as any).updatedAt || (remote as any).updatedAt,
              updatedBy: (local as any).updatedBy || (remote as any).updatedBy,
            } as T)
          : (mergedData as T);
      }
      return result;
    };

    const mergedPages = mergeMap<PageModel>(
      "pages",
      baseSnapshot.pages,
      draft.pages,
      latest.pages,
      true,
    );
    const mergedElements = mergeMap<ElementModel>(
      "elements",
      baseSnapshot.elements,
      draft.elements,
      latest.elements,
      true,
    );
    const mergedDomEdits = mergeMap<StudioDomEdit>(
      "domEdits",
      baseSnapshot.domEdits || {},
      draft.domEdits || {},
      latest.domEdits || {},
      false,
    );

    if (conflicts.length > 0) {
      throw new Error(
        "توقف الدمج الآلي الآمن لأن الطرفين عدّلا نفس البيانات. احتفظنا بالمسودة المحلية ولم نكتب فوق الخادم. " +
          "راجع المقارنة اليدوية أو استخدم الاستعادة/التجاوز بعد مراجعة العناصر التالية: " +
          conflicts.slice(0, 6).join("، "),
      );
    }

    const mergedDraft: StudioDraft = {
      ...draft,
      baseRevision: latest.revision,
      pages: mergedPages,
      elements: mergedElements,
      domEdits: mergedDomEdits,
      updatedAt: new Date().toISOString(),
      hasUnpublishedChanges: true,
      hasUnsavedLocalChanges: true,
    };
    const validation = validateDraftHierarchy(mergedDraft);
    if (!validation.valid) {
      throw new Error(
        "توقف الدمج الآلي لأن النسخة المدمجة تحتاج إلى إصلاح بنية: " +
          validation.errors.slice(0, 5).join(" • "),
      );
    }

    this.inMemoryDraft = mergedDraft;
    this.persistLocalDraft(mergedDraft);
    return mergedDraft;
  }

  /**
   * Publish draft atomically with strict 8-step server confirmation and verification.
   * NEVER simulates a local publication when Supabase fails, rejects, or cannot be verified.
   */
  async publishDraft(
    draft: StudioDraft,
    summary = "تحديث ونشر الواجهات من استوديو المطور",
    author = "admin",
  ): Promise<PublishDraftResult> {
    // Step 1: Validate the complete draft hierarchy and schema
    const validation = validateDraftHierarchy(draft);
    if (!validation.valid) {
      return {
        success: false,
        newRevision: draft.baseRevision,
        error: "فشل التحقق من صحة المخطط: " + validation.errors.join(" | "),
      };
    }

    // Step 2: Ensure the latest draft snapshot is saved & confirmed on Supabase first
    // (Publishing must never silently publish an older snapshot)
    let workingDraft: StudioDraft = draft;
    if (draft.hasUnsavedLocalChanges) {
      const saveResult = await this.saveDraft(draft);
      if (!saveResult.success) {
        return {
          success: false,
          newRevision: draft.baseRevision,
          conflict: saveResult.conflict,
          offline: saveResult.offline,
          error:
            "تعذر حفظ وتأكيد أحدث تعديلات المسودة على Supabase قبل النشر: " +
            (saveResult.error || "خطأ غير معروف"),
        };
      }
      workingDraft = {
        ...draft,
        updatedAt: saveResult.updatedAt,
        serverUpdatedAt: saveResult.serverUpdatedAt || saveResult.updatedAt,
        hasUnsavedLocalChanges: false,
      };
    }

    // Step 3: Check the latest authoritative server revision and conflicts
    let currentPublished: StudioPublishedConfig;
    try {
      currentPublished = await this.fetchRemotePublishedConfig();
    } catch (err: any) {
      const offline = isNetworkOrOfflineError(err);
      return {
        success: false,
        newRevision: workingDraft.baseRevision,
        offline,
        error: await this.formatStudioSyncError(
          err,
          "تعذر الاتصال بخادم Supabase للتحقق من الإصدار المنشور قبل النشر.",
        ),
      };
    }

    const conflictCheck = await this.checkConflicts(workingDraft);
    if (conflictCheck.error) {
      return {
        success: false,
        newRevision: workingDraft.baseRevision,
        offline: conflictCheck.offline,
        error: conflictCheck.error,
      };
    }
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        newRevision: conflictCheck.serverRevision,
        conflict: true,
        error:
          "CONCURRENCY_CONFLICT: تم نشر إصدار أحدث على الخادم (رقم " +
          conflictCheck.serverRevision +
          "). يرجى حل التعارض أولاً.",
      };
    }

    const proposedRevision = (currentPublished.revision || workingDraft.baseRevision || 1) + 1;
    const publishedAt = new Date().toISOString();
    const stampedPages: Record<string, PageModel> = {};
    Object.entries(workingDraft.pages).forEach(([key, page]) => {
      stampedPages[key] = {
        ...page,
        revision: proposedRevision,
        updatedAt: publishedAt,
        updatedBy: author,
      };
    });
    const stampedElements: Record<string, ElementModel> = {};
    Object.entries(workingDraft.elements).forEach(([key, element]) => {
      stampedElements[key] = {
        ...element,
        revision: proposedRevision,
        updatedAt: publishedAt,
        updatedBy: author,
      };
    });
    const nextSummary = summary || "الإصدار رقم " + proposedRevision;
    const packedDomEdits = packDomEditsWithMeta(workingDraft);

    // Step 4 & 5: Publish using the secure Supabase RPC and require an explicit successful server response
    let confirmedRevision = 0;
    try {
      const { data, error } = (await supabase.rpc("publish_studio_configuration" as any, {
        p_expected_revision: workingDraft.baseRevision,
        p_schema_version: CURRENT_SCHEMA_VERSION,
        p_pages: stampedPages,
        p_elements: stampedElements,
        p_dom_edits: packedDomEdits,
        p_summary: nextSummary,
      } as any)) as any;

      if (error) {
        throw error;
      }

      const rpcResult = data as Record<string, any> | null;
      if (!rpcResult || rpcResult.success !== true) {
        if (rpcResult?.conflict) {
          const serverRev = Number(rpcResult.currentRevision || currentPublished.revision);
          return {
            success: false,
            newRevision: serverRev,
            conflict: true,
            error: `CONCURRENCY_CONFLICT: تم نشر إصدار أحدث على الخادم (رقم #${serverRev}). يرجى حل التعارض أولاً.`,
          };
        }
        return {
          success: false,
          newRevision: workingDraft.baseRevision,
          error: String(
            rpcResult?.error ||
              "رفض الخادم اعتماد عملية النشر ولم يؤكد إنشاء إصدار جديد. تم الحفاظ على المسودة المحلية.",
          ),
        };
      }

      confirmedRevision = Number(rpcResult.newRevision);
      if (!Number.isFinite(confirmedRevision) || confirmedRevision <= currentPublished.revision) {
        return {
          success: false,
          newRevision: workingDraft.baseRevision,
          error: "أرجع الخادم رقم إصدار غير صالح أثناء النشر؛ لم يتم اعتماد النشر محليًا.",
        };
      }
    } catch (cloudErr: any) {
      const offline = isNetworkOrOfflineError(cloudErr);
      const formatted = await this.formatStudioSyncError(
        cloudErr,
        "فشل نشر التعديلات على خادم Supabase.",
      );
      // Preserve local draft intact and never simulate publication
      return {
        success: false,
        newRevision: workingDraft.baseRevision,
        offline,
        error: formatted,
      };
    }

    // Step 6: Verify the published revision and stored content by fetching the authoritative server configuration
    let verifiedConfig: StudioPublishedConfig;
    try {
      verifiedConfig = await this.fetchRemotePublishedConfig();
    } catch (verifyErr: any) {
      return {
        success: false,
        newRevision: workingDraft.baseRevision,
        offline: isNetworkOrOfflineError(verifyErr),
        error:
          "تعذر التحقق من الإصدار المنشور على الخادم بعد الإرسال: " +
          String(verifyErr?.message || verifyErr),
      };
    }

    if (
      verifiedConfig.revision !== confirmedRevision ||
      Object.keys(verifiedConfig.pages || {}).length !== Object.keys(stampedPages).length ||
      Object.keys(verifiedConfig.elements || {}).length !== Object.keys(stampedElements).length
    ) {
      return {
        success: false,
        newRevision: workingDraft.baseRevision,
        error: `فشل التحقق من مطابقة البيانات المنشورة على الخادم (الإصدار المتوقع #${confirmedRevision}، الفعلي #${verifiedConfig.revision}). لم يتم تحديث حالة النشر المحلية.`,
      };
    }

    // Step 7: Only after authoritative verification, update local published state, history, and notify runtime
    const historyRecord: StudioHistoryRecord = {
      revision: currentPublished.revision,
      schemaVersion:
        currentPublished.schemaVersion || currentPublished.schema_version || CURRENT_SCHEMA_VERSION,
      publishedBy: currentPublished.publishedBy,
      publishedAt: currentPublished.publishedAt,
      summary: currentPublished.summary,
      snapshot: {
        pages: currentPublished.pages,
        elements: currentPublished.elements,
        domEdits: currentPublished.domEdits || {},
        designSystem: currentPublished.designSystem,
      },
    };

    this.inMemoryHistory.unshift(historyRecord);
    this.inMemoryHistory = this.inMemoryHistory.slice(0, 50);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(this.inMemoryHistory));
      } catch {
        // cache is best-effort
      }
    }

    this.inMemoryPublished = verifiedConfig;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCAL_PUBLISHED_KEY, JSON.stringify(verifiedConfig));
      } catch {
        // server is authoritative
      }
    }

    const refreshedDraft: StudioDraft = {
      ...workingDraft,
      id: workingDraft.id || "draft_" + workingDraft.owner,
      baseRevision: verifiedConfig.revision,
      pages: verifiedConfig.pages,
      elements: verifiedConfig.elements,
      domEdits: verifiedConfig.domEdits || {},
      designSystem: verifiedConfig.designSystem || workingDraft.designSystem,
      assets: verifiedConfig.assets || workingDraft.assets,
      reusableComponents: verifiedConfig.reusableComponents || workingDraft.reusableComponents,
      hasUnpublishedChanges: false,
      hasUnsavedLocalChanges: false,
      updatedAt: verifiedConfig.publishedAt || publishedAt,
    };

    // Advance the draft baseline on the server so subsequent saves use the new baseRevision
    try {
      const saveSynced = await this.saveDraft({
        ...refreshedDraft,
        serverUpdatedAt: workingDraft.serverUpdatedAt,
      });
      if (saveSynced.success) {
        refreshedDraft.updatedAt = saveSynced.updatedAt;
        refreshedDraft.serverUpdatedAt = saveSynced.serverUpdatedAt || saveSynced.updatedAt;
        refreshedDraft.hasUnsavedLocalChanges = false;
        refreshedDraft.hasUnpublishedChanges = false;
      }
    } catch {
      // Non-fatal if draft baseline sync is deferred to next save
    }

    this.inMemoryDraft = refreshedDraft;
    this.persistLocalDraft(refreshedDraft);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("studio_published_updated", { detail: verifiedConfig }));
    }

    return {
      success: true,
      newRevision: verifiedConfig.revision,
      publishedAt: verifiedConfig.publishedAt,
    };
  }

  /**
   * Rollback to a specific past revision (publishes the restored snapshot as a new revision)
   */
  async rollbackRevision(
    targetRevision: number,
    author = "admin",
  ): Promise<PublishDraftResult> {
    try {
      const history = await this.getHistory();
      const targetRecord = history.find((h) => h.revision === targetRevision);

      let snapshotToRestore = targetRecord?.snapshot;

      if (!snapshotToRestore) {
        const { data } = (await supabase
          .from("studio_history" as any)
          .select("*")
          .eq("revision", targetRevision)
          .maybeSingle()) as any;

        if (data && data.snapshot) {
          snapshotToRestore = data.snapshot;
        }
      }

      if (!snapshotToRestore || !snapshotToRestore.pages) {
        return {
          success: false,
          newRevision: 0,
          error: `تعذر العثور على لقطة الإصدار المطلوب (#${targetRevision}) في سجل التعديلات.`,
        };
      }

      const currentPublished = await this.fetchRemotePublishedConfig();
      const unpacked = unpackDomEditsAndMeta((snapshotToRestore as any).domEdits);
      const rollbackDraft: StudioDraft = {
        id: this.inMemoryDraft?.id || `draft_${author}`,
        owner: author,
        baseRevision: currentPublished.revision,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        pages: snapshotToRestore.pages,
        elements: snapshotToRestore.elements,
        domEdits: unpacked.domEdits,
        designSystem: snapshotToRestore.designSystem || unpacked.designSystem,
        assets: unpacked.assets,
        reusableComponents: unpacked.reusableComponents,
        namedSnapshots: this.inMemoryDraft?.namedSnapshots || [],
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        serverUpdatedAt: this.inMemoryDraft?.serverUpdatedAt,
        hasUnpublishedChanges: true,
        hasUnsavedLocalChanges: true,
      };

      return await this.publishDraft(
        rollbackDraft,
        `استعادة الإصدار السابق (#${targetRevision})`,
        author,
      );
    } catch (e: any) {
      return { success: false, newRevision: 0, error: e.message };
    }
  }

  /**
   * Restore a snapshot into the active local draft without overwriting the live published version
   * or deleting history.
   */
  restoreSnapshotToLocalDraft(
    currentDraft: StudioDraft,
    snapshot: {
      pages: Record<string, PageModel>;
      elements: Record<string, ElementModel>;
      domEdits?: Record<string, StudioDomEdit>;
      designSystem?: any;
      assets?: any[];
      reusableComponents?: any[];
    },
  ): StudioDraft {
    const unpacked = unpackDomEditsAndMeta(snapshot.domEdits as any);
    const restored: StudioDraft = {
      ...currentDraft,
      pages: JSON.parse(JSON.stringify(snapshot.pages || {})),
      elements: JSON.parse(JSON.stringify(snapshot.elements || {})),
      domEdits: JSON.parse(JSON.stringify(unpacked.domEdits || {})),
      designSystem: JSON.parse(
        JSON.stringify(
          snapshot.designSystem ||
            unpacked.designSystem ||
            currentDraft.designSystem ||
            DEFAULT_STUDIO_DESIGN_SYSTEM,
        ),
      ),
      assets: JSON.parse(
        JSON.stringify(snapshot.assets || unpacked.assets || currentDraft.assets || []),
      ),
      reusableComponents: JSON.parse(
        JSON.stringify(
          snapshot.reusableComponents ||
            unpacked.reusableComponents ||
            currentDraft.reusableComponents ||
            [],
        ),
      ),
      updatedAt: new Date().toISOString(),
      hasUnpublishedChanges: true,
      hasUnsavedLocalChanges: true,
    };
    this.saveLocalDraft(restored);
    return restored;
  }

  /**
   * Create a named checkpoint snapshot in the draft's persistent snapshot list.
   */
  createNamedSnapshot(
    draft: StudioDraft,
    name: string,
    note = "",
    author = "admin",
  ): { draft: StudioDraft; snapshot: StudioNamedSnapshot } {
    const existingIds = (draft.namedSnapshots || []).map((s) => s.id);
    const snap: StudioNamedSnapshot = {
      id: createStudioId("snap", existingIds),
      name: name.trim() || `نقطة حفظ ${new Date().toLocaleTimeString("ar-EG")}`,
      createdAt: new Date().toISOString(),
      createdBy: author,
      baseRevision: draft.baseRevision,
      note: note.trim(),
      snapshot: {
        pages: JSON.parse(JSON.stringify(draft.pages || {})),
        elements: JSON.parse(JSON.stringify(draft.elements || {})),
        domEdits: JSON.parse(JSON.stringify(draft.domEdits || {})),
        designSystem: JSON.parse(
          JSON.stringify(draft.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM),
        ),
        assets: JSON.parse(JSON.stringify(draft.assets || [])),
        reusableComponents: JSON.parse(JSON.stringify(draft.reusableComponents || [])),
      },
    };
    const nextSnapshots = [snap, ...(draft.namedSnapshots || [])].slice(0, 30);
    const nextDraft: StudioDraft = {
      ...draft,
      namedSnapshots: nextSnapshots,
      updatedAt: new Date().toISOString(),
      hasUnsavedLocalChanges: true,
      hasUnpublishedChanges: true,
    };
    this.saveLocalDraft(nextDraft);
    return { draft: nextDraft, snapshot: snap };
  }

  /**
   * Export complete versioned Studio configuration as formatted JSON.
   */
  exportProjectJson(draft: StudioDraft): string {
    const payload = {
      format: "restocash-developer-studio-pro",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      baseRevision: draft.baseRevision,
      pages: draft.pages || {},
      elements: draft.elements || {},
      domEdits: draft.domEdits || {},
      designSystem: draft.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM,
      assets: draft.assets || [],
      reusableComponents: draft.reusableComponents || [],
      namedSnapshots: draft.namedSnapshots || [],
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Validate and import a Studio configuration JSON into the current draft.
   */
  importProjectJson(
    rawJson: string,
    currentDraft: StudioDraft,
  ): { success: boolean; draft?: StudioDraft; error?: string; warnings?: string[] } {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== "object") {
        return { success: false, error: "ملف JSON غير صالح." };
      }
      if (!parsed.pages || typeof parsed.pages !== "object") {
        return { success: false, error: "ملف الاستيراد لا يحتوي على كائن الصفحات (pages)." };
      }
      if (!parsed.elements || typeof parsed.elements !== "object") {
        return { success: false, error: "ملف الاستيراد لا يحتوي على كائن العناصر (elements)." };
      }

      const unpacked = unpackDomEditsAndMeta(parsed.domEdits);
      const candidate: StudioDraft = {
        ...currentDraft,
        schemaVersion: Number(parsed.schemaVersion || CURRENT_SCHEMA_VERSION),
        pages: parsed.pages,
        elements: parsed.elements,
        domEdits: unpacked.domEdits,
        designSystem: parsed.designSystem || unpacked.designSystem || currentDraft.designSystem,
        assets: Array.isArray(parsed.assets) ? parsed.assets : unpacked.assets,
        reusableComponents: Array.isArray(parsed.reusableComponents)
          ? parsed.reusableComponents
          : unpacked.reusableComponents,
        namedSnapshots: Array.isArray(parsed.namedSnapshots)
          ? parsed.namedSnapshots
          : currentDraft.namedSnapshots || [],
        updatedAt: new Date().toISOString(),
        hasUnpublishedChanges: true,
        hasUnsavedLocalChanges: true,
      };

      const validation = validateDraftHierarchy(candidate);
      if (!validation.valid) {
        return {
          success: false,
          error: "فشل التحقق من بنية الملف المستورد: " + validation.errors.join(" • "),
          warnings: validation.warnings,
        };
      }

      this.saveLocalDraft(candidate);
      return { success: true, draft: candidate, warnings: validation.warnings };
    } catch (e: any) {
      return {
        success: false,
        error: "تعذر قراءة ملف JSON: " + String(e?.message || e),
      };
    }
  }

  /**
   * Get revision history
   */
  async getHistory(): Promise<StudioHistoryRecord[]> {
    try {
      const { data, error } = (await supabase
        .from("studio_history" as any)
        .select("*")
        .order("revision", { ascending: false })
        .limit(40)) as any;

      if (!error && Array.isArray(data) && data.length > 0) {
        const history: StudioHistoryRecord[] = data.map((item) => {
          const unpacked = unpackDomEditsAndMeta(item.snapshot?.domEdits);
          return {
            id: item.id,
            revision: item.revision,
            schemaVersion: item.schema_version || CURRENT_SCHEMA_VERSION,
            publishedBy: item.published_by,
            publishedAt: item.published_at,
            summary: item.summary,
            snapshot: {
              pages: item.snapshot?.pages || {},
              elements: item.snapshot?.elements || {},
              domEdits: unpacked.domEdits,
              designSystem: item.snapshot?.designSystem || unpacked.designSystem,
            },
          };
        });
        this.inMemoryHistory = history;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
          } catch {
            // ignore
          }
        }
        return history;
      }
    } catch {
      // Fallback to cached history
    }

    return this.inMemoryHistory;
  }

  /**
   * Persist the current edit locally without writing to Supabase.
   * Safe to call on every edit; remote sync remains an explicit Save Draft action.
   */
  saveLocalDraft(draft: StudioDraft): { success: boolean; updatedAt: string; error?: string } {
    const updatedAt = new Date().toISOString();
    const localDraft: StudioDraft = {
      ...draft,
      domEdits: draft.domEdits || {},
      designSystem: draft.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM,
      assets: draft.assets || [],
      reusableComponents: draft.reusableComponents || [],
      namedSnapshots: draft.namedSnapshots || [],
      updatedAt,
      hasUnsavedLocalChanges: true,
    };
    this.inMemoryDraft = localDraft;
    if (typeof window === "undefined") return { success: true, updatedAt };
    try {
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(localDraft));
      return { success: true, updatedAt };
    } catch (error: any) {
      return {
        success: false,
        updatedAt,
        error:
          "تعذر حفظ التعديلات محليًا في المتصفح. تحقق من مساحة التخزين وأذونات المتصفح. " +
          String(error?.message || ""),
      };
    }
  }

  /**
   * Apply local Studio edits to this browser's preview runtime.
   */
  applyLocalDomEditsToRuntime(edits: Record<string, any> = {}): {
    success: boolean;
    error?: string;
  } {
    if (typeof window === "undefined") return { success: true };
    const key = "restocash_studio_local_dom_edits_v1";
    try {
      localStorage.setItem(key, JSON.stringify(edits || {}));
      window.dispatchEvent(new CustomEvent("studio_local_edits_updated", { detail: edits || {} }));
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error:
          "تعذر تطبيق تعديلات الاستوديو محليًا على صفحات التطبيق: " +
          String(error?.message || ""),
      };
    }
  }

  /**
   * Adopt a row confirmed by Supabase Realtime without triggering another cloud write.
   */
  acceptRealtimeDraft(draft: StudioDraft): void {
    const unpacked = unpackDomEditsAndMeta(draft.domEdits as any);
    const confirmed: StudioDraft = {
      ...draft,
      domEdits: unpacked.domEdits,
      designSystem: draft.designSystem || unpacked.designSystem,
      assets: draft.assets || unpacked.assets,
      reusableComponents: draft.reusableComponents || unpacked.reusableComponents,
      namedSnapshots: draft.namedSnapshots || unpacked.namedSnapshots,
      serverUpdatedAt: draft.serverUpdatedAt || draft.updatedAt,
      hasUnsavedLocalChanges: false,
    };
    this.inMemoryDraft = confirmed;
    this.persistLocalDraft(confirmed);
  }

  private persistLocalDraft(draft: StudioDraft) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        LOCAL_DRAFT_KEY,
        JSON.stringify({
          ...draft,
          domEdits: draft.domEdits || {},
          designSystem: draft.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM,
        }),
      );
    } catch {
      // storage unavailable
    }
  }
}

export const studioService = new StudioService();
