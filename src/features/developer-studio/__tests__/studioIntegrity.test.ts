import { describe, expect, it } from "vitest";
import type { ElementModel, PageModel, StudioDraft } from "../models/studio.types";
import {
  CURRENT_SCHEMA_VERSION,
  createStudioId,
  isUnmodifiedStudioStarterElement,
  normalizeStudioDraftPageReferences,
  uniquePageElementIds,
  validateDraftHierarchy,
  validatePage,
} from "../models/studio.types";

function makePage(id: string, route: string, elementIds: string[] = []): PageModel {
  return {
    id,
    name: id,
    route,
    elementIds,
    styles: {},
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 1,
    updatedAt: "2026-10-18T00:00:00.000Z",
    updatedBy: "test",
  };
}

function makeElement(
  id: string,
  pageId: string,
  parentId: string | null = null,
  overrides: Partial<ElementModel> = {},
): ElementModel {
  return {
    id,
    pageId,
    parentId,
    type: "card",
    content: { title: "Test card", description: "Test description" },
    styles: { backgroundColor: "#ffffff", borderRadius: "12px" },
    layout: { position: "static", order: 1, visibility: true },
    attributes: {},
    locked: false,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 1,
    updatedAt: "2026-10-18T00:00:00.000Z",
    updatedBy: "test",
    ...overrides,
  };
}

function makeDraft(
  pages: Record<string, PageModel>,
  elements: Record<string, ElementModel> = {},
): StudioDraft {
  return {
    id: "draft_integrity_test",
    owner: "tester",
    baseRevision: 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    pages,
    elements,
    domEdits: {},
    updatedAt: "2026-10-18T00:00:00.000Z",
    createdAt: "2026-10-18T00:00:00.000Z",
    hasUnpublishedChanges: false,
    hasUnsavedLocalChanges: false,
  };
}

describe("Developer Studio — pure integrity regression tests", () => {
  it("deduplicates page references without changing first-seen order", () => {
    expect(uniquePageElementIds(["a", "b", "a", "", "c", "b"])).toEqual(["a", "b", "c"]);
  });

  it("repairs duplicate references immutably and keeps distinct element IDs", () => {
    const draft = makeDraft({
      page_one: makePage("page_one", "/admin/one", ["card_a", "card_a", "card_b"]),
    });
    const result = normalizeStudioDraftPageReferences(draft);

    expect(result.changed).toBe(true);
    expect(result.draft.pages.page_one.elementIds).toEqual(["card_a", "card_b"]);
    expect(draft.pages.page_one.elementIds).toEqual(["card_a", "card_a", "card_b"]);
  });

  it("creates IDs that do not collide with a supplied reservation list", () => {
    const first = createStudioId("elem_card");
    const second = createStudioId("elem_card", [first]);
    expect(first).not.toBe(second);
    expect(first.startsWith("elem_card_")).toBe(true);
    expect(second.startsWith("elem_card_")).toBe(true);
  });

  it("rejects duplicate references and duplicate normalized routes", () => {
    const elements = { card_a: makeElement("card_a", "page_one") };
    const repeatedPage = makePage("page_one", "/admin/one", ["card_a", "card_a"]);
    const repeatedResult = validatePage(repeatedPage, elements);
    expect(repeatedResult.valid).toBe(false);
    expect(repeatedResult.errors.some((error) => error.includes("معرفات مكررة"))).toBe(true);

    const draft = makeDraft({
      page_one: makePage("page_one", "/admin/report", []),
      page_two: makePage("page_two", "/admin/report/", []),
    });
    const hierarchy = validateDraftHierarchy(draft);
    expect(hierarchy.errors.some((error) => error.includes("مكرر بين الصفحتين"))).toBe(true);
  });

  it("rejects a child whose parent belongs to another page", () => {
    const parent = makeElement("parent", "page_two");
    const child = makeElement("child", "page_one", "parent");
    const draft = makeDraft(
      {
        page_one: makePage("page_one", "/admin/one", ["child"]),
        page_two: makePage("page_two", "/admin/two", ["parent"]),
      },
      { parent, child },
    );
    const hierarchy = validateDraftHierarchy(draft);
    expect(hierarchy.errors.some((error) => error.includes("مرتبط بأب من صفحة أخرى"))).toBe(true);
  });

  it("filters only unchanged demo seed elements, not customized elements", () => {
    const starter = makeElement("starter", "page_dashboard", null, {
      content: { title: "Demo starter" },
      styles: { backgroundColor: "#ffffff" },
    });
    expect(isUnmodifiedStudioStarterElement({
      ...starter,
      updatedAt: "2026-10-19T00:00:00.000Z",
    }, starter)).toBe(true);
    expect(isUnmodifiedStudioStarterElement({
      ...starter,
      styles: { ...starter.styles, backgroundColor: "#101010" },
    }, starter)).toBe(false);
    expect(isUnmodifiedStudioStarterElement({ ...starter, id: "custom" }, starter)).toBe(false);
  });
});
