/**
 * Developer Studio Pro — Comprehensive Unit & Integration Tests
 * Validates models, cycle detection, draft lifecycle, atomic publishing,
 * optimistic concurrency conflict detection, smart merging, and rollback.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  ElementModel,
  PageModel,
  StudioDraft,
  validateElement,
  validatePage,
  validateDraftHierarchy,
  createStudioId,
  uniquePageElementIds,
  normalizeStudioDraftPageReferences,
  isUnmodifiedStudioStarterElement,
  detectCycle,
  CURRENT_SCHEMA_VERSION,
} from "../models/studio.types";

let mockServerPublished: any = null;
let mockServerDrafts: Record<string, any> = {};
let mockServerHistory: any[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: "u1", email: "admin@restocash.com" } }, error: null }),
      getSession: async () => ({ data: { session: { user: { id: "u1", email: "admin@restocash.com" } } }, error: null }),
    },
    from: (table: string) => {
      if (table === "studio_published_configs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: mockServerPublished, error: null }),
            }),
          }),
        };
      }
      if (table === "studio_drafts") {
        return {
          select: () => ({
            eq: (_col: string, owner: string) => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: mockServerDrafts[owner] || null, error: null }),
                }),
              }),
              maybeSingle: async () => ({ data: mockServerDrafts[owner] || null, error: null }),
            }),
          }),
        };
      }
      if (table === "studio_history") {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({ data: mockServerHistory, error: null }),
            }),
            eq: (_col: string, rev: number) => ({
              maybeSingle: async () => ({
                data: mockServerHistory.find((h) => h.revision === rev) || null,
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    },
    rpc: async (fnName: string, args: any) => {
      if (fnName === "developer_studio_access_status") {
        return {
          data: { authenticated: true, profile_found: true, allowed: true, role: "admin" },
          error: null,
        };
      }
      if (fnName === "developer_studio_save_draft") {
        const now = new Date().toISOString();
        const owner = args.p_owner || "tester";
        mockServerDrafts[owner] = {
          id: args.p_draft_id || `draft_${owner}`,
          owner,
          base_revision: args.p_base_revision,
          schema_version: args.p_schema_version,
          pages: args.p_pages,
          elements: args.p_elements,
          dom_edits: args.p_dom_edits,
          updated_at: now,
          created_at: now,
        };
        return {
          data: {
            success: true,
            id: mockServerDrafts[owner].id,
            serverUpdatedAt: now,
            base_revision: args.p_base_revision,
          },
          error: null,
        };
      }
      if (fnName === "publish_studio_configuration") {
        const currentRev = mockServerPublished?.revision || 1;
        if (args.p_expected_revision !== currentRev) {
          return {
            data: { success: false, conflict: true, currentRevision: currentRev },
            error: null,
          };
        }
        const nextRev = currentRev + 1;
        const now = new Date().toISOString();
        if (mockServerPublished) {
          mockServerHistory.unshift({
            id: mockServerHistory.length + 1,
            revision: mockServerPublished.revision,
            schema_version: mockServerPublished.schema_version,
            published_by: mockServerPublished.published_by,
            published_at: mockServerPublished.published_at,
            summary: mockServerPublished.summary,
            snapshot: {
              pages: mockServerPublished.pages,
              elements: mockServerPublished.elements,
              domEdits: mockServerPublished.dom_edits,
            },
          });
        }
        mockServerPublished = {
          id: "active",
          revision: nextRev,
          schema_version: args.p_schema_version,
          published_at: now,
          published_by: "admin",
          summary: args.p_summary,
          pages: args.p_pages,
          elements: args.p_elements,
          dom_edits: args.p_dom_edits,
        };
        return {
          data: { success: true, newRevision: nextRev, publishedAt: now },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  },
}));

import { studioService, DEFAULT_STUDIO_PUBLISHED_CONFIG } from "../services/studioService";

describe("Developer Studio Pro — Data Models & Runtime Validation", () => {
  it("creates unique IDs when existing IDs or rapid repeated clicks could collide", () => {
    const first = createStudioId("elem_card", ["elem_card_fixed"]);
    const second = createStudioId("elem_card", [first]);
    expect(first.startsWith("elem_card_")).toBe(true);
    expect(second).not.toBe(first);
  });

  it("removes repeated element references while preserving the original order", () => {
    expect(uniquePageElementIds(["elem_a", "elem_b", "elem_a", "elem_c", "elem_b"])).toEqual([
      "elem_a",
      "elem_b",
      "elem_c",
    ]);
  });

  it("repairs duplicate element references without deleting distinct elements", () => {
    const draft: StudioDraft = {
      id: "draft_dedupe",
      owner: "tester",
      baseRevision: 1,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      pages: {
        page_one: {
          id: "page_one",
          name: "اختبار",
          route: "/admin/test",
          elementIds: ["elem_one", "elem_one", "elem_two"],
          styles: {},
          schemaVersion: CURRENT_SCHEMA_VERSION,
          revision: 1,
          updatedAt: "",
          updatedBy: "tester",
        },
      },
      elements: {} as Record<string, ElementModel>,
      domEdits: {},
      updatedAt: "",
      createdAt: "",
      hasUnpublishedChanges: false,
    };
    const result = normalizeStudioDraftPageReferences(draft);
    expect(result.changed).toBe(true);
    expect(result.draft.pages.page_one.elementIds).toEqual(["elem_one", "elem_two"]);
    expect(draft.pages.page_one.elementIds).toEqual(["elem_one", "elem_one", "elem_two"]);

    const duplicateRouteDraft: StudioDraft = {
      ...result.draft,
      pages: {
        ...result.draft.pages,
        page_two: {
          ...result.draft.pages.page_one,
          id: "page_two",
          name: "اختبار مسار مكرر",
          route: "/admin/test/",
          elementIds: [],
        },
      },
    };
    const hierarchy = validateDraftHierarchy(duplicateRouteDraft);
    expect(hierarchy.errors.some((error) => error.includes("مكرر بين الصفحتين"))).toBe(true);
  });

  it("filters unchanged starter demo elements but keeps a customized version", () => {
    const starter = DEFAULT_STUDIO_PUBLISHED_CONFIG.elements.elem_banner_1;
    expect(isUnmodifiedStudioStarterElement({ ...starter, updatedAt: "2026-10-18T00:00:00.000Z" }, starter)).toBe(true);
    expect(isUnmodifiedStudioStarterElement({
      ...starter,
      styles: { ...starter.styles, backgroundColor: "#111111" },
    }, starter)).toBe(false);
  });

  it("validates valid elements successfully", () => {
    const validElement: ElementModel = {
      id: "elem_test_1",
      pageId: "page_dashboard",
      parentId: null,
      type: "heading",
      content: { text: "عنوان رئيسي", level: "h1" },
      styles: { fontSize: "24px", textColor: "#000000" },
      layout: { position: "static", order: 1, visibility: true },
      attributes: {},
      locked: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "admin",
    };

    const res = validateElement(validElement);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it("rejects elements with missing id, pageId, or invalid type", () => {
    const invalidElement: any = {
      id: "",
      pageId: "",
      type: "unsupported_type",
      content: {},
    };

    const res = validateElement(invalidElement);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("detects cyclic parent hierarchies correctly", () => {
    const elements: Record<string, ElementModel> = {
      elem_A: {
        id: "elem_A",
        pageId: "page_1",
        parentId: "elem_B", // A -> B
        type: "container",
        content: {},
        styles: {},
        layout: { position: "static", order: 1, visibility: true },
        attributes: {},
        locked: false,
        schemaVersion: 1,
        revision: 1,
        updatedAt: "",
        updatedBy: "",
      },
      elem_B: {
        id: "elem_B",
        pageId: "page_1",
        parentId: "elem_A", // B -> A (Cycle!)
        type: "container",
        content: {},
        styles: {},
        layout: { position: "static", order: 2, visibility: true },
        attributes: {},
        locked: false,
        schemaVersion: 1,
        revision: 1,
        updatedAt: "",
        updatedBy: "",
      },
    };

    expect(detectCycle("elem_A", elements)).toBe(true);
  });

  it("validates full page and verifies element references", () => {
    const validPage: PageModel = {
      id: "page_custom",
      name: "صفحة جديدة",
      route: "/admin/custom",
      elementIds: ["elem_1"],
      styles: { padding: "16px" },
      schemaVersion: 1,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "admin",
    };

    const elements: Record<string, ElementModel> = {
      elem_1: {
        id: "elem_1",
        pageId: "page_custom",
        parentId: null,
        type: "card",
        content: { title: "Test Card" },
        styles: {},
        layout: { position: "static", order: 1, visibility: true },
        attributes: {},
        locked: false,
        schemaVersion: 1,
        revision: 1,
        updatedAt: "",
        updatedBy: "",
      },
    };

    const res = validatePage(validPage, elements);
    expect(res.valid).toBe(true);

    // Missing element reference check
    const badPage = { ...validPage, elementIds: ["elem_non_existent"] };
    const badRes = validatePage(badPage, elements);
    expect(badRes.valid).toBe(false);

    const repeatedPage = { ...validPage, elementIds: ["elem_1", "elem_1"] };
    const repeatedRes = validatePage(repeatedPage, elements);
    expect(repeatedRes.valid).toBe(false);
    expect(repeatedRes.errors.some((error) => error.includes("معرفات مكررة"))).toBe(true);
  });
});

describe("Developer Studio Pro — Draft, Publish & Concurrency Service", () => {
  it("initializes a draft based on the latest published configuration", async () => {
    const draft = await studioService.getDraft("tester");
    expect(draft).toBeDefined();
    expect(draft.pages).toBeDefined();
    expect(Object.keys(draft.pages).length).toBeGreaterThan(0);
    expect(draft.baseRevision).toBeGreaterThanOrEqual(1);
  });

  it("saves a draft and updates timestamp and unpublished status", async () => {
    const draft = await studioService.getDraft("tester");
    const updatedDraft: StudioDraft = {
      ...draft,
      pages: {
        ...draft.pages,
        page_test_save: {
          id: "page_test_save",
          name: "صفحة اختبار الحفظ",
          route: "/admin/test-save",
          elementIds: [],
          styles: {},
          schemaVersion: 1,
          revision: draft.baseRevision,
          updatedAt: new Date().toISOString(),
          updatedBy: "tester",
        },
      },
    };

    const saveRes = await studioService.saveDraft(updatedDraft);
    expect(saveRes.success).toBe(true);
    expect(saveRes.updatedAt).toBeDefined();

    const retrieved = await studioService.getDraft("tester");
    expect(retrieved.pages["page_test_save"]).toBeDefined();
    expect(retrieved.hasUnpublishedChanges).toBe(true);
  });

  it("atomically publishes a valid draft and increments revision", async () => {
    const draft = await studioService.getDraft("tester");
    const currentPublished = await studioService.getPublishedConfig();
    const originalRevision = currentPublished.revision;

    // Align base revision
    draft.baseRevision = originalRevision;

    const pubRes = await studioService.publishDraft(
      draft,
      "اختبار النشر الآلي",
      "vitest",
    );
    expect(pubRes.success).toBe(true);
    expect(pubRes.newRevision).toBe(originalRevision + 1);

    // Verify published config updated
    const afterPublished = await studioService.getPublishedConfig();
    expect(afterPublished.revision).toBe(pubRes.newRevision);
  });

  it("detects optimistic concurrency conflicts when base revision is stale", async () => {
    const draft = await studioService.getDraft("tester");
    // Simulate stale base revision
    draft.baseRevision = 0;

    const conflictRes = await studioService.checkConflicts(draft);
    expect(conflictRes.hasConflict).toBe(true);
    expect(conflictRes.conflicts.length).toBeGreaterThan(0);

    // Publishing should reject with conflict
    const pubRes = await studioService.publishDraft(draft, "نشر متعارض", "tester");
    expect(pubRes.success).toBe(false);
    expect(pubRes.error).toContain("CONCURRENCY_CONFLICT");
  });

  it("merges local-only page additions against the current published baseline", async () => {
    const draft = await studioService.getDraft("tester");
    const latest = await studioService.getPublishedConfig();
    draft.baseRevision = latest.revision;
    draft.pages["page_merge_unique"] = {
      id: "page_merge_unique",
      name: "صفحة فريدة مدمجة",
      route: "/admin/unique",
      elementIds: [],
      styles: {},
      schemaVersion: 1,
      revision: latest.revision,
      updatedAt: new Date().toISOString(),
      updatedBy: "tester",
    };

    const merged = await studioService.mergeWithLatest(draft);
    expect(merged.baseRevision).toBe(latest.revision);
    expect(merged.pages["page_merge_unique"]).toBeDefined();
  });

  it("records rollback history and allows restoring a previous revision", async () => {
    const history = await studioService.getHistory();
    expect(Array.isArray(history)).toBe(true);

    if (history.length > 0) {
      const target = history[0];
      const rollbackRes = await studioService.rollbackRevision(target.revision, "tester");
      expect(rollbackRes.success).toBe(true);
      expect(rollbackRes.newRevision).toBeGreaterThan(target.revision);
    }
  });
});
