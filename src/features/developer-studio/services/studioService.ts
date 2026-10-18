/**
 * Developer Studio Pro — Service Layer for Drafts, Publication, Conflict Resolution & Rollback
 */

import { supabase } from "@/integrations/supabase/client";
import {
  StudioDraft,
  StudioPublishedConfig,
  StudioHistoryRecord,
  ConflictDetail,
  PageModel,
  ElementModel,
  StudioDomEdit,
  validateDraftHierarchy,
  CURRENT_SCHEMA_VERSION,
} from "../models/studio.types";

const LOCAL_DRAFT_KEY = "restocash_studio_draft_v1";
const LOCAL_PUBLISHED_KEY = "restocash_studio_published_v1";
const LOCAL_HISTORY_KEY = "restocash_studio_history_v1";

/**
 * Initial Default Seed Configuration
 */
export const DEFAULT_STUDIO_PUBLISHED_CONFIG: StudioPublishedConfig = {
  revision: 1,
  schema_version: CURRENT_SCHEMA_VERSION,
  publishedAt: new Date().toISOString(),
  publishedBy: "system",
  summary: "الإصدار الأولي لنظام استوديو المطور (Default Seed)",
  domEdits: {},
  pages: {
    page_dashboard: {
      id: "page_dashboard",
      route: "/admin",
      name: "لوحة الأقسام الرئيسية",
      elementIds: ["elem_banner_1", "elem_heading_1"],
      styles: { padding: "16px" },
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    },
    page_restaurant: {
      id: "page_restaurant",
      route: "/admin/restaurant",
      name: "إدارة وتشغيل المطعم",
      elementIds: ["elem_rest_hero"],
      styles: { padding: "16px" },
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    },
    page_menu: {
      id: "page_menu",
      route: "/admin/menu",
      name: "إدارة المنيو وقائمة الطعام",
      elementIds: ["elem_menu_badge"],
      styles: { padding: "16px" },
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    },
    page_orders: {
      id: "page_orders",
      route: "/admin/orders",
      name: "سجل الطلبات والمبيعات",
      elementIds: ["elem_orders_card"],
      styles: { padding: "16px" },
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    },
    page_inventory: {
      id: "page_inventory",
      route: "/admin/inventory",
      name: "المخزون والمستودعات",
      elementIds: ["elem_inv_card"],
      styles: { padding: "16px" },
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
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
        title: "لوحة تحكم Restocash ERP",
        description: "مرحباً بك في النظام المتكامل لإدارة المطاعم، نقاط البيع، المخازن والمحاسبة.",
        showHeader: true,
      },
      styles: {
        backgroundColor: "#f8fafc",
        borderColor: "#e2e8f0",
        borderWidth: "1px",
        borderRadius: "16px",
        paddingTop: "20px",
        paddingBottom: "20px",
        paddingLeft: "24px",
        paddingRight: "24px",
        marginBottom: "20px",
        boxShadow: "sm",
      },
      layout: { position: "static", order: 1, visibility: true },
      attributes: {},
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    },
    elem_heading_1: {
      id: "elem_heading_1",
      pageId: "page_dashboard",
      parentId: null,
      type: "heading",
      content: {
        text: "لوحة الأقسام والمرافق التشغيلية",
        level: "h2",
      },
      styles: {
        textColor: "#0f172a",
        fontSize: "20px",
        fontWeight: "800",
        marginBottom: "12px",
      },
      layout: { position: "static", order: 2, visibility: true },
      attributes: {},
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    },
    elem_rest_hero: {
      id: "elem_rest_hero",
      pageId: "page_restaurant",
      parentId: null,
      type: "card",
      content: {
        title: "مركز تشغيل وإدارة المطعم والصالة",
        description: "متابعة نقاط البيع، أجهزة الكابتن، والطلبات الحية والشاشات المطبخية.",
        showHeader: true,
      },
      styles: {
        backgroundColor: "#fffbeb",
        borderColor: "#fde68a",
        borderWidth: "1px",
        borderRadius: "16px",
        paddingTop: "16px",
        paddingBottom: "16px",
        paddingLeft: "20px",
        paddingRight: "20px",
        marginBottom: "16px",
      },
      layout: { position: "static", order: 1, visibility: true },
      attributes: {},
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    },
    elem_menu_badge: {
      id: "elem_menu_badge",
      pageId: "page_menu",
      parentId: null,
      type: "badge",
      content: {
        label: "قائمة الطعام النشطة والمحدثة",
        variant: "success",
      },
      styles: {
        marginBottom: "14px",
      },
      layout: { position: "static", order: 1, visibility: true },
      attributes: {},
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    },
    elem_orders_card: {
      id: "elem_orders_card",
      pageId: "page_orders",
      parentId: null,
      type: "card",
      content: {
        title: "سجل العمليات والفواتير",
        description: "مراجعة وتدقيق فواتير البيع ومتابعة حالات التوصيل والصالة.",
        showHeader: true,
      },
      styles: {
        backgroundColor: "#f0fdf4",
        borderColor: "#bbf7d0",
        borderWidth: "1px",
        borderRadius: "16px",
        paddingTop: "16px",
        paddingBottom: "16px",
        paddingLeft: "20px",
        paddingRight: "20px",
        marginBottom: "16px",
      },
      layout: { position: "static", order: 1, visibility: true },
      attributes: {},
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    },
    elem_inv_card: {
      id: "elem_inv_card",
      pageId: "page_inventory",
      parentId: null,
      type: "card",
      content: {
        title: "مستودعات المواد الخام والمخزون",
        description: "جرد الأصناف ومتابعة المستويات الحرجة وحركات الصرف والتحويل.",
        showHeader: true,
      },
      styles: {
        backgroundColor: "#f0f9ff",
        borderColor: "#bae6fd",
        borderWidth: "1px",
        borderRadius: "16px",
        paddingTop: "16px",
        paddingBottom: "16px",
        paddingLeft: "20px",
        paddingRight: "20px",
        marginBottom: "16px",
      },
      layout: { position: "static", order: 1, visibility: true },
      attributes: {},
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    },
  },
};

class StudioService {
  private inMemoryDraft: StudioDraft | null = null;
  private inMemoryPublished: StudioPublishedConfig | null = null;
  private inMemoryHistory: StudioHistoryRecord[] = [];

  constructor() {
    this.initLocalCache();
  }

  private initLocalCache() {
    if (typeof window === "undefined") return;

    try {
      const storedPublished = localStorage.getItem(LOCAL_PUBLISHED_KEY);
      if (storedPublished) {
        this.inMemoryPublished = JSON.parse(storedPublished);
      } else {
        this.inMemoryPublished = DEFAULT_STUDIO_PUBLISHED_CONFIG;
        localStorage.setItem(LOCAL_PUBLISHED_KEY, JSON.stringify(DEFAULT_STUDIO_PUBLISHED_CONFIG));
      }

      const storedDraft = localStorage.getItem(LOCAL_DRAFT_KEY);
      if (storedDraft) {
        this.inMemoryDraft = JSON.parse(storedDraft);
      }

      const storedHistory = localStorage.getItem(LOCAL_HISTORY_KEY);
      if (storedHistory) {
        this.inMemoryHistory = JSON.parse(storedHistory);
      }
    } catch (e) {
      console.warn("StudioService cache init warning:", e);
    }
  }

  /**
   * Get the active published configuration (from Supabase or local cache)
   */
  private async fetchRemotePublishedConfig(): Promise<StudioPublishedConfig> {
    const { data, error } = (await supabase
      .from("studio_published_configs" as any)
      .select("*")
      .eq("id", "active")
      .maybeSingle()) as any;

    if (error) throw new Error("تعذر تحميل النسخة المنشورة من Supabase: " + error.message);
    if (!data || !data.pages) {
      throw new Error("لا توجد نسخة منشورة مؤكدة على Supabase. شغّل ترحيلات الاستوديو أولاً.");
    }

    return {
      id: data.id || "active",
      revision: Number(data.revision || 1),
      schemaVersion: Number(data.schema_version || CURRENT_SCHEMA_VERSION),
      schema_version: Number(data.schema_version || CURRENT_SCHEMA_VERSION),
      publishedAt: data.published_at || new Date().toISOString(),
      publishedBy: data.published_by || "system",
      summary: data.summary || "Published version",
      pages: data.pages || {},
      elements: data.elements || {},
      domEdits: data.dom_edits || {},
    };
  }

  async getPublishedConfig(): Promise<StudioPublishedConfig> {
    try {
      const config = await this.fetchRemotePublishedConfig();
      this.inMemoryPublished = config;
      if (typeof window !== "undefined") {
        try { localStorage.setItem(LOCAL_PUBLISHED_KEY, JSON.stringify(config)); } catch { /* quota/private mode */ }
      }
      return config;
    } catch (error) {
      console.warn("Studio published config is using the last confirmed local cache:", error);
      if (this.inMemoryPublished) return this.inMemoryPublished;
      return DEFAULT_STUDIO_PUBLISHED_CONFIG;
    }
  }

  /**
   * Accept a server-confirmed Realtime publication event without generating another write.
   */
  acceptRealtimePublishedConfig(config: StudioPublishedConfig): void {
    this.inMemoryPublished = config;
    if (typeof window !== "undefined") {
      try { localStorage.setItem(LOCAL_PUBLISHED_KEY, JSON.stringify(config)); } catch { /* quota/private mode */ }
      window.dispatchEvent(new CustomEvent("studio_published_updated", { detail: config }));
    }
  }

  /**
   * Load or create a draft for the current editor session.
   * If no draft exists, clones from the latest published revision.
   */
  async getDraft(owner = "admin"): Promise<StudioDraft> {
    let cached: StudioDraft | null = this.inMemoryDraft?.owner === owner ? this.inMemoryDraft : null;

    if (!cached && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.pages && parsed.elements && parsed.owner === owner) {
            cached = { ...parsed, domEdits: parsed.domEdits || {} } as StudioDraft;
          }
        }
      } catch {
        // Ignore a damaged local cache and continue with the server.
      }
    }

    try {
      const { data, error } = (await supabase
        .from("studio_drafts" as any)
        .select("*")
        .eq("owner", owner)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()) as any;

      if (error) throw error;
      if (data && data.pages) {
        const remote: StudioDraft = {
          id: data.id || "draft_" + owner,
          owner: data.owner || owner,
          baseRevision: Number(data.base_revision || 1),
          schemaVersion: Number(data.schema_version || CURRENT_SCHEMA_VERSION),
          pages: data.pages || {},
          elements: data.elements || {},
          domEdits: data.dom_edits || {},
          updatedAt: data.updated_at || new Date().toISOString(),
          createdAt: data.created_at || new Date().toISOString(),
          serverUpdatedAt: data.updated_at || undefined,
          hasUnpublishedChanges: true,
        };
        // Dirty local drafts always win over the cached server timestamp, including
        // when the browser clock differs from Supabase or edits have equal timestamps.
        const localIsNewer = !!cached && (
          cached.hasUnsavedLocalChanges === true ||
          (Number.isFinite(Date.parse(cached.updatedAt)) &&
            Date.parse(cached.updatedAt) > Date.parse(remote.updatedAt))
        );
        const chosen = localIsNewer
          ? {
              ...cached!,
              // Unknown legacy baselines must not overwrite an existing cloud row.
              serverUpdatedAt: cached!.serverUpdatedAt || "__unknown_server_version__",
              hasUnsavedLocalChanges: cached!.hasUnsavedLocalChanges === true ||
                (cached!.hasUnsavedLocalChanges === undefined && !cached!.serverUpdatedAt),
            }
          : { ...remote, hasUnsavedLocalChanges: false };
        this.inMemoryDraft = chosen;
        this.persistLocalDraft(chosen);
        return chosen;
      }
    } catch (error) {
      // Keep offline work editable, but do not pretend later saves are cloud-confirmed.
      if (cached) {
        const pending = { ...cached, hasUnsavedLocalChanges: true };
        this.inMemoryDraft = pending;
        return pending;
      }
      console.warn("Could not load the remote studio draft:", error);
    }

    if (cached) {
      // No server row was returned: keep the local copy, but do not label it
      // as a server-confirmed clean draft.
      const pending = { ...cached, hasUnpublishedChanges: true, hasUnsavedLocalChanges: true };
      this.inMemoryDraft = pending;
      return pending;
    }

    const published = await this.getPublishedConfig();
    const newDraft: StudioDraft = {
      id: "draft_" + owner,
      owner,
      baseRevision: published.revision,
      schemaVersion: published.schemaVersion || published.schema_version || CURRENT_SCHEMA_VERSION,
      pages: JSON.parse(JSON.stringify(published.pages || {})),
      elements: JSON.parse(JSON.stringify(published.elements || {})),
      domEdits: JSON.parse(JSON.stringify(published.domEdits || {})),
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      hasUnpublishedChanges: false,
      hasUnsavedLocalChanges: false,
    };

    this.inMemoryDraft = newDraft;
    this.persistLocalDraft(newDraft);
    return newDraft;
  }

  /**
   * Persist a draft only when explicitly requested by the user (manual Save Draft).
   */
  async saveDraft(
    draft: StudioDraft,
  ): Promise<{ success: boolean; updatedAt: string; error?: string }> {
    // Preserve the locally generated timestamp so a request can be distinguished from
    // subsequent local edits made while its network request is in flight.
    const updatedAt = draft.updatedAt || new Date().toISOString();
    const updatedDraft: StudioDraft = {
      ...draft,
      domEdits: draft.domEdits || {},
      updatedAt,
      hasUnpublishedChanges: true,
      hasUnsavedLocalChanges: true,
    };

    const contentKey = (value: StudioDraft) => JSON.stringify([
      value.baseRevision,
      value.schemaVersion,
      value.pages || {},
      value.elements || {},
      value.domEdits || {},
    ]);
    const hasNewerLocalChanges = (current: StudioDraft | null): boolean =>
      !!current &&
      current.hasUnsavedLocalChanges === true &&
      contentKey(current) !== contentKey(updatedDraft);

    // The editor already saved locally before starting sync. Only refresh that recovery
    // copy here if it still matches the submitted snapshot; never replace a newer edit.
    if (!hasNewerLocalChanges(this.inMemoryDraft)) {
      this.inMemoryDraft = updatedDraft;
      this.persistLocalDraft(updatedDraft);
    }

    try {
      // Use the permission-checked SECURITY DEFINER RPC. This avoids a direct
      // client SELECT dependency on studio_drafts and compares the server version
      // atomically under a row lock before writing.
      const { data, error } = (await supabase.rpc("developer_studio_save_draft" as any, {
        p_owner: updatedDraft.owner,
        p_draft_id: updatedDraft.id || "draft_" + updatedDraft.owner,
        p_expected_updated_at: updatedDraft.serverUpdatedAt || null,
        p_base_revision: updatedDraft.baseRevision,
        p_schema_version: updatedDraft.schemaVersion,
        p_pages: updatedDraft.pages,
        p_elements: updatedDraft.elements,
        p_dom_edits: updatedDraft.domEdits || {},
      } as any)) as any;

      if (error) throw error;
      const saved = data as Record<string, any> | null;
      if (!saved?.success) {
        throw new Error(saved?.error || (saved?.conflict
          ? "تغيرت المسودة على الخادم من جلسة أخرى. احتفظنا بتعديلاتك محليًا ولم تتم الكتابة فوقها."
          : "لم يؤكد Supabase حفظ المسودة؛ بقيت النسخة المحلية غير متزامنة."));
      }

      const serverUpdatedAt = String(saved.serverUpdatedAt || saved.updatedAt || updatedAt);
      const confirmedDraft = {
        ...updatedDraft,
        id: String(saved.id || updatedDraft.id),
        updatedAt: serverUpdatedAt,
        serverUpdatedAt,
        hasUnsavedLocalChanges: false,
      };
      // An earlier save can succeed after the user has already made newer changes.
      // The remote row confirms this submitted snapshot only; do not overwrite the newer
      // recovery copy in memory/localStorage with this older confirmed response.
      if (!hasNewerLocalChanges(this.inMemoryDraft)) {
        this.inMemoryDraft = confirmedDraft;
        this.persistLocalDraft(confirmedDraft);
      }
      return { success: true, updatedAt: confirmedDraft.updatedAt };
    } catch (e: any) {
      const raw = String(e?.message || e?.details || "تعذر تأكيد حفظ المسودة على الخادم.");

      if (/permission denied for function developer_studio_save_draft/i.test(raw)) {
        try {
          const payload = {
            base_revision: updatedDraft.baseRevision,
            schema_version: updatedDraft.schemaVersion,
            pages: updatedDraft.pages,
            elements: updatedDraft.elements,
            dom_edits: updatedDraft.domEdits || {},
            updated_at: new Date().toISOString(),
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
            if (!data) throw new Error("تغيرت المسودة على الخادم أثناء الحفظ؛ أعد فحص التوافق قبل المحاولة.");
            savedRow = data;
          } else {
            const now = payload.updated_at;
            const { data, error: directError } = (await supabase
              .from("studio_drafts" as any)
              .insert({
                id: updatedDraft.id || "draft_" + updatedDraft.owner,
                owner: updatedDraft.owner,
                ...payload,
                created_at: now,
              } as any)
              .select("id, updated_at")
              .maybeSingle()) as any;
            if (directError) throw directError;
            if (!data) throw new Error("لم يؤكد الخادم إنشاء المسودة الجديدة.");
            savedRow = data;
          }

          const confirmedAt = String(savedRow.updated_at || payload.updated_at);
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
          return { success: true, updatedAt: confirmedAt };
        } catch (fallbackError: any) {
          return {
            success: false,
            updatedAt,
            error: "تعذر حفظ المسودة عبر دالة RPC، وفشلت محاولة الحفظ المباشر الآمنة. طبّق ترحيل صلاحيات الاستوديو. التفاصيل: " +
              raw + " | " + String(fallbackError?.message || fallbackError || "فشل الحفظ المباشر"),
          };
        }
      }

      let actionable = raw;
      if (/developer_studio_save_draft|function .* does not exist|schema cache/i.test(raw)) {
        actionable = "قاعدة البيانات تحتاج إلى دوال المزامنة الآمنة. نفّذ ملف supabase/migrations/20261015100000_studio_local_first_sync_rpcs.sql في Supabase SQL Editor ثم أعد المحاولة. التفاصيل: " + raw;
      } else if (/column .*dom_edits.* does not exist|dom_edits.*column/i.test(raw)) {
        actionable = "قاعدة البيانات تحتاج إلى التحديث قبل حفظ معاينة التطبيق. نفّذ ملف supabase/migrations/20261015100000_studio_local_first_sync_rpcs.sql في Supabase SQL Editor ثم أعد المحاولة. التفاصيل: " + raw;
      } else if (/row-level security|permission denied|not authorized/i.test(raw)) {
        let accessHint = "";
        try {
          const { data: accessData, error: accessError } = await supabase.rpc("developer_studio_access_status" as any);
          const access = accessData as any;
          if (!accessError && access) {
            if (access.authenticated === false) {
              accessHint = "لا توجد جلسة دخول Supabase صالحة داخل المعاينة. سجّل الخروج ثم الدخول مرة أخرى.";
            } else if (access.profile_found === false) {
              accessHint = "تم تسجيل الدخول، لكن لا يوجد صف في public.profiles يطابق auth.uid() للحساب الحالي. اربط الحساب بملفه الصحيح أولًا.";
            } else if (access.allowed === false) {
              accessHint = "ملف المستخدم موجود لكن لا يملك صلاحية الاستوديو. اضبط developer_options=true أو role=admin/super_admin في public.profiles ثم أعد المحاولة.";
            } else {
              accessHint = "الجلسة والملف والصلاحية صحيحة حسب فحص الخادم؛ غالبًا لم يُطبّق ترحيل إصلاح سياسات RLS أو توجد سياسة قديمة.";
            }
          }
        } catch {
          // The diagnostic RPC is only available after the new RLS repair migration is applied.
        }
        actionable = (accessHint || "رفضت Supabase الحفظ بسبب الصلاحيات. يلزم حساب مصادق عليه وصف public.profiles مطابق لـ auth.uid() مع developer_options=true أو role=admin/super_admin. نفّذ ترحيل إصلاح RLS ثم أعد المحاولة.") + " التفاصيل: " + raw;
      } else if (/relation .*studio_drafts.* does not exist|studio_drafts.*does not exist/i.test(raw)) {
        actionable = "جداول الاستوديو غير موجودة في Supabase. نفّذ بالترتيب 20261014120000_developer_studio_pro.sql ثم 20261014140000_harden_developer_studio.sql ثم 20261015100000_studio_local_first_sync_rpcs.sql. التفاصيل: " + raw;
      }
      return { success: false, updatedAt, error: actionable };
    }
  }

  /**
   * Discard all draft changes and reset back to the latest published config
   */
  /**
   * Confirm the shared draft has not been changed by another browser/session.
   * This read-only check happens after local-first persistence and before cloud upsert.
   */
  async checkDraftSyncCompatibility(draft: StudioDraft): Promise<{
    compatible: boolean;
    serverUpdatedAt?: string;
    needsRebase?: boolean;
    serverDraft?: StudioDraft;
    message?: string;
    error?: string;
  }> {
    try {
      const { data, error } = (await supabase.rpc("developer_studio_check_draft_sync" as any, {
        p_owner: draft.owner,
        p_expected_updated_at: draft.serverUpdatedAt || null,
      } as any)) as any;
      if (error) throw error;

      const result = data as Record<string, any> | null;
      if (!result) {
        return { compatible: false, error: "Supabase لم يُرجع نتيجة لفحص توافق المسودة؛ لم تتم المزامنة." };
      }
      const serverDraftData = result.serverDraft;
      const serverDraft: StudioDraft | undefined = serverDraftData ? {
        id: String(serverDraftData.id || "draft_" + draft.owner),
        owner: String(serverDraftData.owner || draft.owner),
        baseRevision: Number(serverDraftData.baseRevision || 1),
        schemaVersion: Number(serverDraftData.schemaVersion || CURRENT_SCHEMA_VERSION),
        pages: serverDraftData.pages || {},
        elements: serverDraftData.elements || {},
        domEdits: serverDraftData.domEdits || {},
        updatedAt: String(serverDraftData.updatedAt || result.serverUpdatedAt || new Date().toISOString()),
        serverUpdatedAt: String(serverDraftData.serverUpdatedAt || result.serverUpdatedAt || ""),
        createdAt: String(serverDraftData.createdAt || serverDraftData.updatedAt || new Date().toISOString()),
        hasUnpublishedChanges: true,
        hasUnsavedLocalChanges: false,
      } : undefined;

      return {
        compatible: result.compatible === true,
        serverUpdatedAt: result.serverUpdatedAt ? String(result.serverUpdatedAt) : undefined,
        needsRebase: result.needsRebase === true,
        serverDraft,
        message: result.message ? String(result.message) : undefined,
        error: result.error ? String(result.error) : undefined,
      };
    } catch (error: any) {
      const raw = String(error?.message || error?.details || "تعذر فحص توافق المسودة.");
      if (/permission denied for function developer_studio_check_draft_sync/i.test(raw)) {
        // Older deployments may have the table RLS grants but miss EXECUTE on the
        // compatibility RPC. Read the same admin-protected row directly as a safe fallback.
        try {
          const { data, error: fallbackError } = (await supabase
            .from("studio_drafts" as any)
            .select("*")
            .eq("owner", draft.owner)
            .maybeSingle()) as any;
          if (fallbackError) throw fallbackError;

          if (!data) {
            return draft.serverUpdatedAt
              ? { compatible: false, error: "لم تعد المسودة السحابية موجودة؛ احتفظنا بالنسخة المحلية ولم نكتب فوق أي نسخة." }
              : { compatible: true, needsRebase: false, message: "لا توجد مسودة بعيدة؛ يمكن إنشاء أول نسخة محفوظة." };
          }

          const serverUpdatedAt = String(data.updated_at || "");
          const serverDraft: StudioDraft = {
            id: String(data.id || "draft_" + draft.owner),
            owner: String(data.owner || draft.owner),
            baseRevision: Number(data.base_revision || 1),
            schemaVersion: Number(data.schema_version || CURRENT_SCHEMA_VERSION),
            pages: data.pages || {},
            elements: data.elements || {},
            domEdits: data.dom_edits || {},
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
              message: "تمت قراءة المسودة المحفوظة مباشرة بسبب نقص صلاحية RPC؛ ستُدمج تعديلاتك محليًا قبل الحفظ.",
            };
          }
          if (Date.parse(serverUpdatedAt) !== Date.parse(draft.serverUpdatedAt)) {
            return {
              compatible: false,
              serverUpdatedAt,
              serverDraft,
              error: "تغيرت المسودة السحابية من جلسة أخرى. احتفظنا بتعديلاتك المحلية ولم نستبدل النسخة البعيدة.",
            };
          }
          return { compatible: true, needsRebase: false, serverUpdatedAt };
        } catch (fallbackError: any) {
          return {
            compatible: false,
            error: "تعذر فحص توافق المسودة عبر RPC أو القراءة المباشرة؛ احتفظنا بالتعديلات محليًا. طبّق ترحيل صلاحيات الاستوديو. التفاصيل: " +
              raw + " | " + String(fallbackError?.message || fallbackError || "فشل الفحص المباشر"),
          };
        }
      }

      const migrationHint = /developer_studio_check_draft_sync|function .* does not exist|schema cache/i.test(raw)
        ? "دالة فحص مزامنة المسودة غير موجودة أو لم تُحدّث. نفّذ supabase/migrations/20261015100000_studio_local_first_sync_rpcs.sql ثم ترحيل إصلاح الصلاحيات."
        : "";
      return {
        compatible: false,
        error: "تعذر تأكيد توافق نسخة المسودة مع Supabase؛ احتفظنا بالتعديلات محليًا ولم تتم المزامنة. " + migrationHint + " " + raw,
      };
    }
  }

  async discardDraft(owner = "admin"): Promise<StudioDraft> {
    // Discard only the in-memory edits: restore the last manually saved server draft.
    // If no saved draft exists, restore the latest published configuration.
    const { data, error } = (await supabase
      .from("studio_drafts" as any)
      .select("*")
      .eq("owner", owner)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as any;

    if (error) {
      throw new Error("تعذر تحميل آخر مسودة محفوظة من Supabase؛ لم يتم إلغاء التعديلات: " + error.message);
    }

    let freshDraft: StudioDraft;
    if (data?.pages && data?.elements) {
      freshDraft = {
        id: data.id || "draft_" + owner,
        owner: data.owner || owner,
        baseRevision: Number(data.base_revision || 1),
        schemaVersion: Number(data.schema_version || CURRENT_SCHEMA_VERSION),
        pages: data.pages || {},
        elements: data.elements || {},
        domEdits: data.dom_edits || {},
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
        schemaVersion: published.schemaVersion || published.schema_version || CURRENT_SCHEMA_VERSION,
        pages: JSON.parse(JSON.stringify(published.pages || {})),
        elements: JSON.parse(JSON.stringify(published.elements || {})),
        domEdits: JSON.parse(JSON.stringify(published.domEdits || {})),
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
   * Used only by the conflict-resolution action whose meaning is "Reload Latest".
   */
  async reloadLatestPublishedDraft(owner = "admin"): Promise<StudioDraft> {
    const published = await this.fetchRemotePublishedConfig();
    const { error } = await supabase
      .from("studio_drafts" as any)
      .delete()
      .eq("owner", owner);
    if (error) {
      throw new Error("تعذر حذف المسودة القديمة من Supabase؛ لم يتم تحميل أحدث نسخة: " + error.message);
    }

    const freshDraft: StudioDraft = {
      id: "draft_" + owner,
      owner,
      baseRevision: published.revision,
      schemaVersion: published.schemaVersion || published.schema_version || CURRENT_SCHEMA_VERSION,
      pages: JSON.parse(JSON.stringify(published.pages || {})),
      elements: JSON.parse(JSON.stringify(published.elements || {})),
      domEdits: JSON.parse(JSON.stringify(published.domEdits || {})),
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
   * Check for optimistic concurrency conflicts before publishing
   */
  async checkConflicts(draft: StudioDraft): Promise<{
    hasConflict: boolean;
    serverRevision: number;
    conflicts: ConflictDetail[];
    error?: string;
  }> {
    let latestPublished: StudioPublishedConfig;
    try {
      latestPublished = await this.fetchRemotePublishedConfig();
    } catch (e: any) {
      return {
        hasConflict: false,
        serverRevision: this.inMemoryPublished?.revision || 1,
        conflicts: [],
        error: e?.message || "تعذر الاتصال بنسخة النشر على Supabase.",
      };
    }
    const conflicts: ConflictDetail[] = [];

    // If base revision matches, no revision gap conflict
    if (draft.baseRevision === latestPublished.revision) {
      return {
        hasConflict: false,
        serverRevision: latestPublished.revision,
        conflicts: [],
      };
    }

    // Server has a higher revision: identify conflicting pages and elements
    conflicts.push({
      type: "revision_gap",
      targetId: "system",
      title: "تعارض في رقم الإصدار",
      localValue: draft.baseRevision,
      serverValue: latestPublished.revision,
      description: `تم نشر إصدار أحدث (رقم ${latestPublished.revision}) بواسطة مستخدم آخر منذ بدء جلسة التعديل الحالية (التي تستند إلى الإصدار ${draft.baseRevision}).`,
    });

    // Check specific page differences
    Object.keys(draft.pages).forEach((pageId) => {
      const serverPage = latestPublished.pages[pageId];
      const localPage = draft.pages[pageId];
      if (!serverPage) {
        // Page was deleted or renamed on server
        conflicts.push({
          type: "page_modified",
          targetId: pageId,
          title: `الصفحة: ${localPage.name}`,
          localValue: localPage,
          serverValue: null,
          description: `تم حذف أو تعديل هذه الصفحة على الخادم في الإصدار الجديد.`,
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

    // Check element conflicts
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
      throw new Error("الإصدار المرجعي للمسودة أحدث من الإصدار المنشور على الخادم؛ أعد تحميل المسودة قبل الدمج.");
    }

    // Use the exact published version the draft started from. A merge without this
    // baseline cannot distinguish a local edit from a stale copy of a remote edit.
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
      return "{" + Object.keys(value).sort().map((key) =>
        JSON.stringify(key) + ":" + stableValue(value[key]),
      ).join(",") + "}";
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

      if (path.endsWith(".elementIds") &&
          Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
        const baseSet = new Set(base);
        const localSet = new Set(local);
        const remoteSet = new Set(remote);
        const baseKeptInLocalOrder = local.filter((id) => baseSet.has(id));
        const baseKeptInRemoteOrder = remote.filter((id) => baseSet.has(id));
        const baseInLocalOrder = base.filter((id) => localSet.has(id));
        const baseInRemoteOrder = base.filter((id) => remoteSet.has(id));
        const localReordered = !sameValue(baseKeptInLocalOrder, baseInLocalOrder);
        const remoteReordered = !sameValue(baseKeptInRemoteOrder, baseInRemoteOrder);
        if (localReordered && remoteReordered &&
            !sameValue(baseKeptInLocalOrder.filter((id) => remoteSet.has(id)),
              baseKeptInRemoteOrder.filter((id) => localSet.has(id)))) {
          conflicts.push(path + " (تعارض ترتيب العناصر)");
          return remote;
        }

        // Preserve the latest server order, apply independent deletions from either
        // side, and append non-conflicting elements added by either side.
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
        const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
        for (const key of keys) {
          const value = mergeValue(base[key], local[key], remote[key], path + "." + key);
          if (value !== undefined) merged[key] = value;
        }
        return merged;
      }

      conflicts.push(path);
      // Keep the server value for this leaf while collecting all conflicting paths.
      // The merge will be rejected below, so the local draft itself remains untouched.
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
      const keys = new Set([...Object.keys(baseMap || {}), ...Object.keys(localMap || {}), ...Object.keys(remoteMap || {})]);
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
            if (!sameValue(comparableLocal, comparableRemote)) conflicts.push(path + " (معرّف جديد متعارض)");
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
          ? {
              ...(remote as T),
              ...(mergedData as T),
              // Preserve server metadata until a confirmed publication stamps a new revision.
              revision: (remote as any).revision,
              updatedAt: (local as any).updatedAt || (remote as any).updatedAt,
              updatedBy: (local as any).updatedBy || (remote as any).updatedBy,
            } as T
          : mergedData as T;
      }
      return result;
    };

    const mergedPages = mergeMap<PageModel>("pages", baseSnapshot.pages, draft.pages, latest.pages, true);
    const mergedElements = mergeMap<ElementModel>("elements", baseSnapshot.elements, draft.elements, latest.elements, true);
    const mergedDomEdits = mergeMap<StudioDomEdit>("domEdits", baseSnapshot.domEdits || {}, draft.domEdits || {}, latest.domEdits || {}, false);

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
      throw new Error("توقف الدمج الآلي لأن النسخة المدمجة تحتاج إلى إصلاح بنية: " + validation.errors.slice(0, 5).join(" • "));
    }

    // Smart merge prepares an in-memory draft; only Save Draft may persist it.
    this.inMemoryDraft = mergedDraft;
    return mergedDraft;
  }

  /**
   * Publish draft atomically
   */
  async publishDraft(
    draft: StudioDraft,
    summary = "تحديث ونشر الواجهات من استوديو المطور",
    author = "admin",
  ): Promise<{ success: boolean; newRevision: number; error?: string }> {
    const validation = validateDraftHierarchy(draft);
    if (!validation.valid) {
      return { success: false, newRevision: draft.baseRevision, error: "فشل التحقق من صحة المخطط: " + validation.errors.join(" | ") };
    }

    let currentPublished: StudioPublishedConfig;
    try {
      currentPublished = await this.fetchRemotePublishedConfig();
    } catch (e: any) {
      return { success: false, newRevision: draft.baseRevision, error: e?.message || "تعذر تحميل النسخة الحالية من Supabase. لم يتم النشر." };
    }

    const conflictCheck = await this.checkConflicts(draft);
    if (conflictCheck.error) {
      return { success: false, newRevision: currentPublished.revision, error: conflictCheck.error };
    }
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        newRevision: conflictCheck.serverRevision,
        error: "CONCURRENCY_CONFLICT: تم نشر إصدار أحدث على الخادم (رقم " + conflictCheck.serverRevision + "). يرجى حل التعارض أولاً.",
      };
    }

    const proposedRevision = currentPublished.revision + 1;
    const publishedAt = new Date().toISOString();
    const stampedPages: Record<string, PageModel> = {};
    Object.entries(draft.pages).forEach(([key, page]) => {
      stampedPages[key] = { ...page, revision: proposedRevision, updatedAt: publishedAt, updatedBy: author };
    });
    const stampedElements: Record<string, ElementModel> = {};
    Object.entries(draft.elements).forEach(([key, element]) => {
      stampedElements[key] = { ...element, revision: proposedRevision, updatedAt: publishedAt, updatedBy: author };
    });
    const nextSummary = summary || ("الإصدار رقم " + proposedRevision);

    try {
      // Database transaction locks the active row, verifies the base revision,
      // snapshots history and writes the new published state atomically.
      const { data, error } = await supabase.rpc("publish_studio_configuration" as any, {
        p_expected_revision: draft.baseRevision,
        p_schema_version: CURRENT_SCHEMA_VERSION,
        p_pages: stampedPages,
        p_elements: stampedElements,
        p_dom_edits: draft.domEdits || {},
        p_summary: nextSummary,
      } as any);

      if (error) throw new Error(error.message || "رفض Supabase عملية النشر.");
      const result: any = data;
      if (!result || result.success !== true) {
        const latestRevision = Number(result?.currentRevision || result?.newRevision || currentPublished.revision);
        if (result?.conflict) {
          return {
            success: false,
            newRevision: latestRevision,
            error: "CONCURRENCY_CONFLICT: تغيرت النسخة المنشورة أثناء النشر إلى الإصدار " + latestRevision + ". أعد تحميل المسودة وحل التعارض.",
          };
        }
        return { success: false, newRevision: latestRevision, error: result?.error || "لم يؤكد الخادم النشر؛ لم يتم تحديث الحالة محليًا." };
      }

      const confirmedRevision = Number(result.newRevision || proposedRevision);
      const confirmedConfig: StudioPublishedConfig = {
        id: "active",
        revision: confirmedRevision,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        schema_version: CURRENT_SCHEMA_VERSION,
        publishedAt,
        publishedBy: author,
        summary: nextSummary,
        pages: stampedPages,
        elements: stampedElements,
        domEdits: draft.domEdits || {},
      };
      const historyRecord: StudioHistoryRecord = {
        revision: currentPublished.revision,
        schemaVersion: currentPublished.schemaVersion || currentPublished.schema_version || CURRENT_SCHEMA_VERSION,
        publishedBy: currentPublished.publishedBy,
        publishedAt: currentPublished.publishedAt,
        summary: currentPublished.summary,
        snapshot: {
          pages: currentPublished.pages,
          elements: currentPublished.elements,
          domEdits: currentPublished.domEdits || {},
        },
      };

      this.inMemoryHistory.unshift(historyRecord);
      this.inMemoryHistory = this.inMemoryHistory.slice(0, 50);
      if (typeof window !== "undefined") {
        try { localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(this.inMemoryHistory)); } catch { /* cache is best-effort */ }
      }
      this.inMemoryPublished = confirmedConfig;
      if (typeof window !== "undefined") {
        try { localStorage.setItem(LOCAL_PUBLISHED_KEY, JSON.stringify(confirmedConfig)); } catch { /* server is authoritative */ }
      }

      const refreshedDraft: StudioDraft = {
        ...draft,
        id: draft.id || "draft_" + draft.owner,
        baseRevision: confirmedRevision,
        pages: stampedPages,
        elements: stampedElements,
        domEdits: draft.domEdits || {},
        hasUnpublishedChanges: false,
        updatedAt: publishedAt,
      };
      this.inMemoryDraft = refreshedDraft;
      this.persistLocalDraft(refreshedDraft);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("studio_published_updated", { detail: confirmedConfig }));
      }
      return { success: true, newRevision: confirmedRevision };
    } catch (e: any) {
      return { success: false, newRevision: draft.baseRevision, error: e?.message || "فشل النشر. لم يتم تأكيد النسخة الجديدة على الخادم." };
    }
  }

  /**
   * Rollback to a specific past revision
   */
  async rollbackRevision(
    targetRevision: number,
    author = "admin",
  ): Promise<{ success: boolean; newRevision: number; error?: string }> {
    try {
      const history = await this.getHistory();
      const targetRecord = history.find((h) => h.revision === targetRevision);

      let snapshotToRestore = targetRecord?.snapshot;

      if (!snapshotToRestore) {
        // Query Supabase directly
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

      const currentPublished = await this.getPublishedConfig();
      const rollbackDraft: StudioDraft = {
        id: `rollback_${Date.now()}`,
        owner: author,
        baseRevision: currentPublished.revision,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        pages: snapshotToRestore.pages,
        elements: snapshotToRestore.elements,
        domEdits: (snapshotToRestore as any).domEdits || {},
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        hasUnpublishedChanges: true,
      };

      const result = await this.publishDraft(
        rollbackDraft,
        `استعادة الإصدار السابق (#${targetRevision})`,
        author,
      );

      return result;
    } catch (e: any) {
      return { success: false, newRevision: 0, error: e.message };
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
        .limit(30)) as any;

      if (!error && Array.isArray(data) && data.length > 0) {
        const history: StudioHistoryRecord[] = data.map((item) => ({
          id: item.id,
          revision: item.revision,
          schemaVersion: item.schema_version || CURRENT_SCHEMA_VERSION,
          publishedBy: item.published_by,
          publishedAt: item.published_at,
          summary: item.summary,
          snapshot: item.snapshot,
        }));
        this.inMemoryHistory = history;
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
        }
        return history;
      }
    } catch {
      // Fallback
    }

    return this.inMemoryHistory;
  }

  /**
   * Persist the current edit locally without writing to Supabase.
   * This is safe to call for editing operations; remote sync remains an explicit action.
   */
  saveLocalDraft(draft: StudioDraft): { success: boolean; updatedAt: string; error?: string } {
    const updatedAt = new Date().toISOString();
    const localDraft: StudioDraft = {
      ...draft,
      domEdits: draft.domEdits || {},
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
        error: "تعذر حفظ التعديلات محليًا في المتصفح. تحقق من مساحة التخزين وأذونات المتصفح. " + String(error?.message || ""),
      };
    }
  }

  /**
   * Apply local Studio edits to this browser's real application pages.
   * This does not call Supabase; the iframe preview and same-browser app tabs consume this map.
   */
  applyLocalDomEditsToRuntime(edits: Record<string, any> = {}): { success: boolean; error?: string } {
    if (typeof window === "undefined") return { success: true };
    const key = "restocash_studio_local_dom_edits_v1";
    try {
      localStorage.setItem(key, JSON.stringify(edits || {}));
      window.dispatchEvent(new CustomEvent("studio_local_edits_updated", { detail: edits || {} }));
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: "تعذر تطبيق تعديلات الاستوديو محليًا على صفحات التطبيق: " + String(error?.message || ""),
      };
    }
  }

  /**
   * Adopt a row confirmed by Supabase Realtime without triggering another cloud write.
   */
  acceptRealtimeDraft(draft: StudioDraft): void {
    const confirmed = {
      ...draft,
      domEdits: draft.domEdits || {},
      serverUpdatedAt: draft.serverUpdatedAt || draft.updatedAt,
      hasUnsavedLocalChanges: false,
    };
    this.inMemoryDraft = confirmed;
    this.persistLocalDraft(confirmed);
  }

  private persistLocalDraft(draft: StudioDraft) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ ...draft, domEdits: draft.domEdits || {} }));
    } catch {
      // storage unavailable
    }
  }
}

export const studioService = new StudioService();
