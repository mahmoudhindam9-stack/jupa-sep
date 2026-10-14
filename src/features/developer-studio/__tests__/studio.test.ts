/**
 * Developer Studio Pro — Comprehensive Unit & Integration Tests
 * Validates models, cycle detection, draft lifecycle, atomic publishing,
 * optimistic concurrency conflict detection, smart merging, and rollback.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  ElementModel,
  PageModel,
  StudioDraft,
  validateElement,
  validatePage,
  validateDraftHierarchy,
  detectCycle,
  CURRENT_SCHEMA_VERSION,
} from "../models/studio.types";
import { studioService, DEFAULT_STUDIO_PUBLISHED_CONFIG } from "../services/studioService";

describe("Developer Studio Pro — Data Models & Runtime Validation", () => {
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

  it("merges non-conflicting changes with latest published config safely", async () => {
    const draft = await studioService.getDraft("tester");
    draft.baseRevision = 0;
    draft.pages["page_merge_unique"] = {
      id: "page_merge_unique",
      name: "صفحة فريدة مدمجة",
      route: "/admin/unique",
      elementIds: [],
      styles: {},
      schemaVersion: 1,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "tester",
    };

    const merged = await studioService.mergeWithLatest(draft);
    const latest = await studioService.getPublishedConfig();
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
