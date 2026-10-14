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
          hasUnpublishedChanges: true,
        };
        const localIsNewer = !!cached &&
          Number.isFinite(Date.parse(cached.updatedAt)) &&
          Date.parse(cached.updatedAt) > Date.parse(remote.updatedAt);
        const chosen = localIsNewer
          ? { ...cached!, hasUnsavedLocalChanges: true }
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
   * Save draft (autosave / manual save) with timestamp and change detection
   */
  async saveDraft(
    draft: StudioDraft,
  ): Promise<{ success: boolean; updatedAt: string; error?: string }> {
    const updatedAt = new Date().toISOString();
    const updatedDraft: StudioDraft = {
      ...draft,
      domEdits: draft.domEdits || {},
      updatedAt,
      hasUnpublishedChanges: true,
      hasUnsavedLocalChanges: true,
    };

    // Retain an explicitly marked recovery copy while the manual save is in flight.
    // This method is called only by the user-triggered Save Draft action.
    this.inMemoryDraft = updatedDraft;
    this.persistLocalDraft(updatedDraft);

    try {
      // Select the existing row ID first. This works even on installations where
      // the hardening migration has not yet installed the unique(owner) index.
      const { data: existing, error: lookupError } = (await supabase
        .from("studio_drafts" as any)
        .select("id, owner")
        .eq("owner", updatedDraft.owner)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()) as any;
      if (lookupError) throw lookupError;

      const draftId = existing?.id || updatedDraft.id || "draft_" + updatedDraft.owner;
      const { data, error } = (await supabase
        .from("studio_drafts" as any)
        .upsert({
          id: draftId,
          owner: updatedDraft.owner,
          base_revision: updatedDraft.baseRevision,
          schema_version: updatedDraft.schemaVersion,
          pages: updatedDraft.pages,
          elements: updatedDraft.elements,
          dom_edits: updatedDraft.domEdits || {},
          updated_at: updatedAt,
        }, { onConflict: "id" })
        .select("id, owner, updated_at")
        .maybeSingle()) as any;

      if (error) throw error;
      if (!data || data.owner !== updatedDraft.owner) {
        throw new Error("لم يؤكد Supabase حفظ المسودة؛ بقيت نسخة محلية غير متزامنة.");
      }

      const confirmedDraft = {
        ...updatedDraft,
        id: data.id || updatedDraft.id,
        updatedAt: data.updated_at || updatedAt,
        hasUnsavedLocalChanges: false,
      };
      this.inMemoryDraft = confirmedDraft;
      this.persistLocalDraft(confirmedDraft);
      return { success: true, updatedAt: confirmedDraft.updatedAt };
    } catch (e: any) {
      const raw = String(e?.message || e?.details || "تعذر تأكيد حفظ المسودة على الخادم.");
      let actionable = raw;
      if (/column .*dom_edits.* does not exist|dom_edits.*column/i.test(raw)) {
        actionable = "قاعدة البيانات تحتاج إلى التحديث قبل حفظ معاينة التطبيق. نفّذ ملف supabase/migrations/20261014153000_fix_developer_studio_rls_and_access_diagnostics.sql في Supabase SQL Editor ثم أعد المحاولة. التفاصيل: " + raw;
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
        actionable = "جداول الاستوديو غير موجودة في Supabase. نفّذ بالترتيب 20261014120000_developer_studio_pro.sql ثم 20261014140000_harden_developer_studio.sql ثم 20261014153000_fix_developer_studio_rls_and_access_diagnostics.sql. التفاصيل: " + raw;
      }
      return { success: false, updatedAt, error: actionable };
    }
  }

  /**
   * Discard all draft changes and reset back to the latest published config
   */
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
    const latest = await this.getPublishedConfig();
    const mergedPages: Record<string, PageModel> = {
      ...latest.pages,
      ...draft.pages,
    };
    const mergedElements: Record<string, ElementModel> = {
      ...latest.elements,
      ...draft.elements,
    };

    const mergedDraft: StudioDraft = {
      ...draft,
      baseRevision: latest.revision,
      pages: mergedPages,
      elements: mergedElements,
      updatedAt: new Date().toISOString(),
      hasUnpublishedChanges: true,
    };

    this.inMemoryDraft = mergedDraft;
    this.persistLocalDraft(mergedDraft);
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
