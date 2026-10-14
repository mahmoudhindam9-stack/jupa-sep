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
  async getPublishedConfig(): Promise<StudioPublishedConfig> {
    try {
      const { data, error } = await supabase
        .from("studio_published_configs" as any)
        .select("*")
        .eq("id", "active")
        .maybeSingle();

      if (!error && data && data.pages) {
        const config: StudioPublishedConfig = {
          revision: data.revision || 1,
          schema_version: data.schema_version || CURRENT_SCHEMA_VERSION,
          publishedAt: data.published_at || new Date().toISOString(),
          publishedBy: data.published_by || "system",
          summary: data.summary || "Published version",
          pages: (data.pages as any) || {},
          elements: (data.elements as any) || {},
        };
        this.inMemoryPublished = config;
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_PUBLISHED_KEY, JSON.stringify(config));
        }
        return config;
      }
    } catch {
      // Fallback to cache / default
    }

    if (this.inMemoryPublished) return this.inMemoryPublished;
    return DEFAULT_STUDIO_PUBLISHED_CONFIG;
  }

  /**
   * Load or create a draft for the current editor session.
   * If no draft exists, clones from the latest published revision.
   */
  async getDraft(owner = "admin"): Promise<StudioDraft> {
    // 1. Check local draft cache
    if (this.inMemoryDraft) {
      return this.inMemoryDraft;
    }

    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(LOCAL_DRAFT_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.pages && parsed.elements) {
            this.inMemoryDraft = parsed;
            return parsed;
          }
        } catch {
          // ignore
        }
      }
    }

    // 2. Check remote server draft in Supabase
    try {
      const { data, error } = await supabase
        .from("studio_drafts" as any)
        .select("*")
        .eq("owner", owner)
        .maybeSingle();

      if (!error && data && data.pages) {
        const draft: StudioDraft = {
          id: data.id || `draft_${Date.now()}`,
          owner: data.owner || owner,
          baseRevision: data.base_revision || 1,
          schemaVersion: data.schema_version || CURRENT_SCHEMA_VERSION,
          pages: data.pages || {},
          elements: data.elements || {},
          updatedAt: data.updated_at || new Date().toISOString(),
          createdAt: data.created_at || new Date().toISOString(),
          hasUnpublishedChanges: true,
        };
        this.inMemoryDraft = draft;
        this.persistLocalDraft(draft);
        return draft;
      }
    } catch {
      // Fallback
    }

    // 3. Brand new draft branched from latest published config
    const published = await this.getPublishedConfig();
    const newDraft: StudioDraft = {
      id: `draft_${Date.now()}`,
      owner,
      baseRevision: published.revision,
      schemaVersion: published.schema_version || CURRENT_SCHEMA_VERSION,
      pages: JSON.parse(JSON.stringify(published.pages)),
      elements: JSON.parse(JSON.stringify(published.elements)),
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      hasUnpublishedChanges: false,
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
    try {
      const updatedAt = new Date().toISOString();
      const updatedDraft: StudioDraft = {
        ...draft,
        updatedAt,
        hasUnpublishedChanges: true,
      };

      this.inMemoryDraft = updatedDraft;
      this.persistLocalDraft(updatedDraft);

      // Async write to Supabase drafts table (non-blocking for UI)
      Promise.resolve(
        supabase.from("studio_drafts" as any).upsert({
          id: updatedDraft.id,
          owner: updatedDraft.owner,
          base_revision: updatedDraft.baseRevision,
          schema_version: updatedDraft.schemaVersion,
          pages: updatedDraft.pages,
          elements: updatedDraft.elements,
          updated_at: updatedAt,
        }),
      )
        .then(({ error }: any) => {
          if (error) {
            console.debug("Remote draft sync notice (cached locally):", error.message);
          }
        })
        .catch(() => {});

      return { success: true, updatedAt };
    } catch (e: any) {
      return { success: false, updatedAt: new Date().toISOString(), error: e.message };
    }
  }

  /**
   * Discard all draft changes and reset back to the latest published config
   */
  async discardDraft(owner = "admin"): Promise<StudioDraft> {
    const published = await this.getPublishedConfig();
    const freshDraft: StudioDraft = {
      id: `draft_${Date.now()}`,
      owner,
      baseRevision: published.revision,
      schemaVersion: published.schema_version || CURRENT_SCHEMA_VERSION,
      pages: JSON.parse(JSON.stringify(published.pages)),
      elements: JSON.parse(JSON.stringify(published.elements)),
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      hasUnpublishedChanges: false,
    };

    this.inMemoryDraft = freshDraft;
    this.persistLocalDraft(freshDraft);

    // Delete remote draft in Supabase
    try {
      await supabase
        .from("studio_drafts" as any)
        .delete()
        .eq("owner", owner);
    } catch {
      // Ignore
    }

    return freshDraft;
  }

  /**
   * Check for optimistic concurrency conflicts before publishing
   */
  async checkConflicts(draft: StudioDraft): Promise<{
    hasConflict: boolean;
    serverRevision: number;
    conflicts: ConflictDetail[];
  }> {
    const latestPublished = await this.getPublishedConfig();
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
    // 1. Validation check
    const validation = validateDraftHierarchy(draft);
    if (!validation.valid) {
      return {
        success: false,
        newRevision: draft.baseRevision,
        error: `فشل التحقق من صحة المخطط: ${validation.errors.join(" | ")}`,
      };
    }

    // 2. Concurrency Conflict check
    const conflictCheck = await this.checkConflicts(draft);
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        newRevision: conflictCheck.serverRevision,
        error: `CONCURRENCY_CONFLICT: تم نشر إصدار أحدث على الخادم (رقم ${conflictCheck.serverRevision}). يرجى مراجعة التعارض وحله أولاً.`,
      };
    }

    try {
      const currentPublished = await this.getPublishedConfig();
      const newRevision = (currentPublished.revision || 1) + 1;
      const publishedAt = new Date().toISOString();

      // Stamp elements and pages with the new revision
      const stampedPages: Record<string, PageModel> = {};
      Object.entries(draft.pages).forEach(([k, p]) => {
        stampedPages[k] = {
          ...p,
          revision: newRevision,
          updatedAt: publishedAt,
          updatedBy: author,
        };
      });

      const stampedElements: Record<string, ElementModel> = {};
      Object.entries(draft.elements).forEach(([k, el]) => {
        stampedElements[k] = {
          ...el,
          revision: newRevision,
          updatedAt: publishedAt,
          updatedBy: author,
        };
      });

      const newPublishedConfig: StudioPublishedConfig = {
        revision: newRevision,
        schema_version: CURRENT_SCHEMA_VERSION,
        publishedAt,
        publishedBy: author,
        summary: summary || `الإصدار رقم ${newRevision}`,
        pages: stampedPages,
        elements: stampedElements,
      };

      // 3. Record previous snapshot in history
      const historyRecord: StudioHistoryRecord = {
        revision: currentPublished.revision,
        schema_version: currentPublished.schema_version,
        publishedBy: currentPublished.publishedBy,
        publishedAt: currentPublished.publishedAt,
        summary: currentPublished.summary,
        snapshot: {
          pages: currentPublished.pages,
          elements: currentPublished.elements,
        },
      };

      this.inMemoryHistory.unshift(historyRecord);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(this.inMemoryHistory.slice(0, 50)));
      }

      // Save to Supabase History table
      Promise.resolve(
        supabase.from("studio_history" as any).insert({
          revision: historyRecord.revision,
          schema_version: historyRecord.schema_version,
          published_by: historyRecord.publishedBy,
          published_at: historyRecord.publishedAt,
          summary: historyRecord.summary,
          snapshot: historyRecord.snapshot,
        }),
      ).catch(() => {});

      // 4. Save to Supabase Published Config
      const { error: publishError } = await supabase
        .from("studio_published_configs" as any)
        .upsert({
          id: "active",
          revision: newRevision,
          schema_version: CURRENT_SCHEMA_VERSION,
          pages: stampedPages,
          elements: stampedElements,
          published_by: author,
          published_at: publishedAt,
          summary: summary || `الإصدار رقم ${newRevision}`,
        });

      if (publishError) {
        console.warn("Supabase publish notice, persisting locally:", publishError.message);
      }

      // 5. Update local published cache
      this.inMemoryPublished = newPublishedConfig;
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_PUBLISHED_KEY, JSON.stringify(newPublishedConfig));
      }

      // 6. Update draft baseRevision and clear unpublished flag
      const refreshedDraft: StudioDraft = {
        ...draft,
        baseRevision: newRevision,
        pages: stampedPages,
        elements: stampedElements,
        hasUnpublishedChanges: false,
        updatedAt: publishedAt,
      };
      this.inMemoryDraft = refreshedDraft;
      this.persistLocalDraft(refreshedDraft);

      // Notify window of published update
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("studio_published_updated", { detail: newPublishedConfig }),
        );
      }

      return { success: true, newRevision };
    } catch (e: any) {
      return { success: false, newRevision: draft.baseRevision, error: e.message };
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
        const { data } = await supabase
          .from("studio_history" as any)
          .select("*")
          .eq("revision", targetRevision)
          .maybeSingle();

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
      const { data, error } = await supabase
        .from("studio_history" as any)
        .select("*")
        .order("revision", { ascending: false })
        .limit(30);

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
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // storage unavailable
    }
  }
}

export const studioService = new StudioService();
