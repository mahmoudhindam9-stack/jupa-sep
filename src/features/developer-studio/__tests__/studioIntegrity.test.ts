import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ElementModel, PageModel, StudioDraft, StudioAssetItem } from "../models/studio.types";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_STUDIO_DESIGN_SYSTEM,
  createStudioId,
  isUnmodifiedStudioStarterElement,
  normalizeStudioDraftPageReferences,
  uniquePageElementIds,
  validateDraftHierarchy,
  validatePage,
  packDomEditsWithMeta,
  unpackDomEditsAndMeta,
  findAssetUsages,
  calculateContrastRatio,
  runStudioAudits,
  compareStudioSnapshots,
} from "../models/studio.types";

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
      getSession: (...args: any[]) => mockGetSession(...args),
    },
  },
}));

import { studioService, withStudioTimeout } from "../services/studioService";

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
  overrides: Partial<StudioDraft> = {},
): StudioDraft {
  return {
    id: "draft_integrity_test",
    owner: "admin",
    baseRevision: 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    pages,
    elements,
    domEdits: {},
    designSystem: DEFAULT_STUDIO_DESIGN_SYSTEM,
    assets: [],
    reusableComponents: [],
    namedSnapshots: [],
    updatedAt: "2026-10-18T00:00:00.000Z",
    createdAt: "2026-10-18T00:00:00.000Z",
    hasUnpublishedChanges: false,
    hasUnsavedLocalChanges: false,
    ...overrides,
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

describe("Developer Studio — Save, Publish & Failure Integrity Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "admin@restocash.com" } } });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1", email: "admin@restocash.com" } } } });
  });

  it("NEVER reports saved when developer_studio_save_draft RPC fails, while preserving local draft", async () => {
    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === "developer_studio_save_draft") {
        return { data: null, error: { message: "RLS permission denied for studio_drafts" } };
      }
      if (fnName === "developer_studio_access_status") {
        return { data: { authenticated: true, profile_found: true, allowed: true, role: "admin" }, error: null };
      }
      return { data: null, error: null };
    });

    const draft = makeDraft(
      { page_dashboard: makePage("page_dashboard", "/admin", []) },
      {},
      {
        domEdits: { "h1.hero": { text: "عنوان معدل", styles: { color: "#1d4ed8" } } },
        hasUnsavedLocalChanges: true,
      },
    );

    const saveRes = await studioService.saveDraft(draft);

    expect(saveRes.success).toBe(false);
    expect(saveRes.error).toContain("RLS permission denied");

    // Local recovery draft must still preserve the user's changes as unsaved
    const rawLocal = window.localStorage.getItem("restocash_studio_draft_v1");
    expect(rawLocal).toBeTruthy();
    const parsedLocal = JSON.parse(rawLocal!);
    expect(parsedLocal.hasUnsavedLocalChanges).toBe(true);
    expect(parsedLocal.domEdits["h1.hero"].text).toBe("عنوان معدل");
  });

  it("confirms cloud save only when developer_studio_save_draft returns success and valid serverUpdatedAt", async () => {
    const serverTimestamp = "2026-11-04T12:30:00.000Z";
    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === "developer_studio_save_draft") {
        return {
          data: {
            success: true,
            id: "draft_admin",
            serverUpdatedAt: serverTimestamp,
            base_revision: 1,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const draft = makeDraft(
      { page_dashboard: makePage("page_dashboard", "/admin", []) },
      {},
      {
        domEdits: { "button.cta": { text: "احجز الآن" } },
        hasUnsavedLocalChanges: true,
      },
    );

    const saveRes = await studioService.saveDraft(draft);
    expect(saveRes.success).toBe(true);
    expect(saveRes.updatedAt).toBe(serverTimestamp);

    const parsedLocal = JSON.parse(window.localStorage.getItem("restocash_studio_draft_v1")!);
    expect(parsedLocal.hasUnsavedLocalChanges).toBe(false);
    expect(parsedLocal.serverUpdatedAt).toBe(serverTimestamp);
  });

  it("NEVER simulates a successful publish when publish_studio_configuration RPC fails", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    mockFrom.mockImplementation((table: string) => {
      if (table === "studio_published_configs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "active",
                  revision: 2,
                  schema_version: CURRENT_SCHEMA_VERSION,
                  pages: { page_dashboard: makePage("page_dashboard", "/admin", []) },
                  elements: {},
                  dom_edits: {},
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) };
    });

    mockRpc.mockImplementation(async (fnName: string) => {
      if (fnName === "publish_studio_configuration") {
        return { data: null, error: { message: "Database connection timeout during publish" } };
      }
      return { data: null, error: null };
    });

    const draft = makeDraft(
      { page_dashboard: makePage("page_dashboard", "/admin", []) },
      {},
      {
        baseRevision: 2,
        domEdits: { ".header-title": { text: "تعديل غير منشور" } },
        hasUnsavedLocalChanges: false,
      },
    );
    studioService.saveLocalDraft(draft);

    const pubRes = await studioService.publishDraft(
      { ...draft, hasUnsavedLocalChanges: false },
      "محاولة نشر فاشلة",
    );

    expect(pubRes.success).toBe(false);
    expect(pubRes.error).toContain("Database connection timeout");

    // Must NOT dispatch studio_published_updated
    const publishedEvents = dispatchSpy.mock.calls.filter(
      (call) => (call[0] as Event)?.type === "studio_published_updated",
    );
    expect(publishedEvents.length).toBe(0);

    // Local draft must still be preserved with its edits intact
    const savedLocal = JSON.parse(window.localStorage.getItem("restocash_studio_draft_v1")!);
    expect(savedLocal.domEdits[".header-title"].text).toBe("تعديل غير منشور");
  });

  it("saves dirty draft first, calls publish RPC, verifies remote revision, and updates published state on success", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    let publishedRowRevision = 3;
    let publishedDomEdits: Record<string, any> = {};

    mockFrom.mockImplementation((table: string) => {
      if (table === "studio_published_configs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "active",
                  revision: publishedRowRevision,
                  schema_version: CURRENT_SCHEMA_VERSION,
                  published_at: "2026-11-04T13:00:00.000Z",
                  published_by: "admin@restocash.com",
                  summary: "نشر ناجح",
                  pages: { page_dashboard: makePage("page_dashboard", "/admin", []) },
                  elements: {},
                  dom_edits: publishedDomEdits,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) };
    });

    mockRpc.mockImplementation(async (fnName: string, args: any) => {
      if (fnName === "developer_studio_save_draft") {
        return {
          data: {
            success: true,
            id: "draft_admin",
            serverUpdatedAt: "2026-11-04T12:59:55.000Z",
            base_revision: 3,
          },
          error: null,
        };
      }
      if (fnName === "publish_studio_configuration") {
        publishedRowRevision = 4;
        publishedDomEdits = args.p_dom_edits || {};
        return {
          data: {
            success: true,
            newRevision: 4,
            publishedAt: "2026-11-04T13:00:00.000Z",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const dirtyDraft = makeDraft(
      { page_dashboard: makePage("page_dashboard", "/admin", []) },
      {},
      {
        baseRevision: 3,
        domEdits: { ".kpi-card": { text: "إجمالي المبيعات اليومية", styles: { backgroundColor: "#0f172a" } } },
        hasUnsavedLocalChanges: true,
        hasUnpublishedChanges: true,
      },
    );

    const pubRes = await studioService.publishDraft(dirtyDraft, "نشر ناجح");

    expect(pubRes.success).toBe(true);
    expect(pubRes.newRevision).toBe(4);
    expect(mockRpc).toHaveBeenCalledWith("developer_studio_save_draft", expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith("publish_studio_configuration", expect.any(Object));

    const publishedEvents = dispatchSpy.mock.calls.filter(
      (call) => (call[0] as Event)?.type === "studio_published_updated",
    );
    expect(publishedEvents.length).toBe(1);
  });
});

describe("Developer Studio — Design System, Assets, Audits, Snapshots & Export/Import", () => {
  it("packs and unpacks Studio metadata inside dom_edits without polluting selectors", () => {
    const cleanEdits = {
      "header.main": { text: "لوحة التحكم", styles: { color: "#ffffff" } },
    };
    const customAssets: StudioAssetItem[] = [
      {
        id: "asset_1",
        name: "logo.svg",
        url: "https://example.com/logo.svg",
        type: "svg",
        mimeType: "image/svg+xml",
        folder: "الأيقونات",
        sizeBytes: 1024,
        createdAt: "2026-11-04T00:00:00.000Z",
        updatedAt: "2026-11-04T00:00:00.000Z",
      },
    ];
    const packed = packDomEditsWithMeta({
      domEdits: cleanEdits,
      designSystem: DEFAULT_STUDIO_DESIGN_SYSTEM,
      assets: customAssets,
      reusableComponents: [],
      namedSnapshots: [],
    });

    expect(packed["__studio_meta__"]).toBeDefined();
    const unpacked = unpackDomEditsAndMeta(packed);
    expect(unpacked.domEdits["__studio_meta__"]).toBeUndefined();
    expect(unpacked.domEdits["header.main"].text).toBe("لوحة التحكم");
    expect(unpacked.assets).toHaveLength(1);
    expect(unpacked.assets[0].name).toBe("logo.svg");
  });

  it("detects in-use assets across DOM edits and Studio elements", () => {
    const assetUrl = "https://example.com/banner.png";
    const draft = makeDraft(
      { page_dashboard: makePage("page_dashboard", "/admin", ["img_1"]) },
      {
        img_1: makeElement("img_1", "page_dashboard", null, {
          type: "image",
          content: { src: assetUrl },
        }),
      },
      {
        domEdits: {
          ".hero-box": { styles: { backgroundImage: `url('${assetUrl}')` } },
        },
      },
    );

    const usages = findAssetUsages({ id: "asset_banner", url: assetUrl }, draft);
    expect(usages.length).toBe(2);
  });

  it("runs Accessibility, Responsive, and Design Consistency audits and calculates contrast", () => {
    expect(calculateContrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 1);
    expect(calculateContrastRatio("#000000", "#ffffff")).toBeGreaterThan(20);

    const draft = makeDraft(
      { page_dashboard: makePage("page_dashboard", "/admin", []) },
      {},
      {
        domEdits: {
          "button.low-contrast": {
            text: "",
            styles: { color: "#f8fafc", backgroundColor: "#ffffff", width: "900px", fontSize: "10px" },
          },
          "img.hero": {
            attributes: { src: "https://example.com/img.png", alt: "" },
          },
        },
      },
    );

    const issues = runStudioAudits(draft);
    expect(issues.some((i) => i.category === "accessibility")).toBe(true);
    expect(issues.some((i) => i.category === "responsive")).toBe(true);
  });

  it("creates named checkpoints, restores snapshots to draft, and compares versions", () => {
    const baseDraft = makeDraft(
      { page_dashboard: makePage("page_dashboard", "/admin", []) },
      {},
      { domEdits: { ".title": { text: "النسخة الأولى" } } },
    );

    const { draft: withCheckpoint, snapshot } = studioService.createNamedSnapshot(baseDraft, "قبل تعديل الهيدر");
    expect(withCheckpoint.namedSnapshots).toHaveLength(1);
    expect(snapshot.name).toBe("قبل تعديل الهيدر");

    const modifiedDraft: StudioDraft = {
      ...withCheckpoint,
      domEdits: {
        ".title": { text: "النسخة الثانية" },
        ".subtitle": { text: "عنوان فرعي مضاف" },
      },
    };

    const diffs = compareStudioSnapshots(baseDraft, modifiedDraft);
    expect(diffs.some((d) => d.path === "domEdits..title" && d.changeType === "modified")).toBe(true);
    expect(diffs.some((d) => d.path === "domEdits..subtitle" && d.changeType === "added")).toBe(true);

    const restored = studioService.restoreSnapshotToLocalDraft(modifiedDraft, snapshot.snapshot);
    expect(restored.domEdits?.[".title"]?.text).toBe("النسخة الأولى");
    expect(restored.domEdits?.[".subtitle"]).toBeUndefined();
    expect(restored.hasUnsavedLocalChanges).toBe(true);
  });

  it("exports and imports versioned Studio project JSON safely", () => {
    const draft = makeDraft(
      { page_dashboard: makePage("page_dashboard", "/admin", []) },
      {},
      { domEdits: { ".card": { text: "بيانات مصدرة" } } },
    );

    const json = studioService.exportProjectJson(draft);
    const imported = studioService.importProjectJson(json, draft);

    expect(imported.success).toBe(true);
    expect(imported.draft?.domEdits?.[".card"]?.text).toBe("بيانات مصدرة");
    expect(imported.draft?.hasUnsavedLocalChanges).toBe(true);

    const invalidImport = studioService.importProjectJson("{bad json", draft);
    expect(invalidImport.success).toBe(false);
  });

  it("terminates hung requests via withStudioTimeout instead of hanging indefinitely", async () => {
    const neverResolvingPromise = new Promise<string>(() => {
      // Simulates a hung network request
    });

    await expect(
      withStudioTimeout(neverResolvingPromise, 40, "اختبار مهلة الاتصال"),
    ).rejects.toThrow("اختبار مهلة الاتصال timed out after 40ms");
  });

  it("initializes local draft and published config synchronously in 0ms without calling Supabase", () => {
    mockFrom.mockClear();
    mockRpc.mockClear();

    const localDraft = makeDraft(
      { page_dashboard: makePage("page_dashboard", "/admin", []) },
      {},
      {
        domEdits: { ".instant-load": { text: "محمل فوراً" } },
        hasUnsavedLocalChanges: true,
      },
    );
    studioService.saveLocalDraft(localDraft);

    const loaded = studioService.getImmediateLocalOrDefaultDraft("admin");
    const pubCfg = studioService.getImmediateLocalOrDefaultPublishedConfig();

    expect(loaded.domEdits?.[".instant-load"]?.text).toBe("محمل فوراً");
    expect(loaded.hasUnsavedLocalChanges).toBe(true);
    expect(pubCfg.revision).toBeGreaterThanOrEqual(1);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("completes syncWithServerInBackground when Supabase hangs and never overwrites newer local unsaved edits", async () => {
    const localDraft = makeDraft(
      { page_dashboard: makePage("page_dashboard", "/admin", []) },
      {},
      {
        baseRevision: 4,
        domEdits: { ".local-unsaved": { text: "تعديل محلي غير محفوظ" } },
        hasUnsavedLocalChanges: true,
        hasUnpublishedChanges: true,
      },
    );
    studioService.saveLocalDraft(localDraft);

    // Simulate a hanging Supabase request that exceeds timeoutMs
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            new Promise(() => {
              // hangs forever
            }),
        }),
      }),
    }));

    const result = await studioService.syncWithServerInBackground("admin", 50);

    expect(result.draft.domEdits?.[".local-unsaved"]?.text).toBe("تعديل محلي غير محفوظ");
    expect(result.draft.hasUnsavedLocalChanges).toBe(true);
    expect(result.preservedNewerLocalChanges).toBe(true);
  });

  it("creates a recoverable backup in localStorage before running any automatic cleanup or migration", () => {
    window.localStorage.removeItem("restocash_studio_clean_v2");
    window.localStorage.setItem("custom_text_map", JSON.stringify({ hero: "نص قديم" }));
    window.localStorage.setItem(
      "restocash_studio_draft_v1",
      JSON.stringify(
        makeDraft(
          { page_dashboard: makePage("page_dashboard", "/admin", []) },
          {},
          { domEdits: { ".preserved-card": { text: "محتوى محفوظ" } } },
        ),
      ),
    );

    const draft = studioService.getImmediateLocalOrDefaultDraft("admin");
    expect(draft.domEdits?.[".preserved-card"]?.text).toBe("محتوى محفوظ");

    const backup = studioService.getLocalDraftBackup();
    expect(backup).toBeTruthy();
    expect(backup?.reason).toBe("pre_clean_v2_migration");
    expect(backup?.entries?.custom_text_map).toContain("نص قديم");
    expect(backup?.entries?.restocash_studio_draft_v1).toContain("محتوى محفوظ");
  });
});

