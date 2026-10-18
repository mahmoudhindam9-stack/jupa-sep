/**
 * Developer Studio Pro — Strongly Typed Models & Runtime Validation
 */

export type ElementType =
  | "heading"
  | "text"
  | "button"
  | "image"
  | "card"
  | "container"
  | "table"
  | "input"
  | "badge"
  | "divider";

export interface HeadingContent {
  text: string;
  level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export interface TextContent {
  text: string;
  format?: "plain" | "markdown";
}

export interface ButtonContent {
  label: string;
  action?: "link" | "submit" | "alert" | "none" | "external" | "formula" | "toggle";
  /** Internal app route or external URL, depending on the chosen action. */
  url?: string;
  /** Friendly message shown when the button is clicked. */
  message?: string;
  /** Arithmetic expression used by the calculation action. */
  formula?: string;
  /** Existing visual element affected by the show/hide action. */
  targetElementId?: string;
  variant?: "default" | "secondary" | "outline" | "destructive" | "ghost";
}

export interface ImageContent {
  src: string;
  alt: string;
  fit?: "cover" | "contain" | "fill";
}

export interface CardContent {
  title?: string;
  subtitle?: string;
  description?: string;
  showHeader?: boolean;
}

export interface ContainerContent {
  direction?: "row" | "column";
  wrap?: boolean;
}

export interface TableColumn {
  id: string;
  label: string;
}

export interface TableContent {
  columns: TableColumn[];
  rows: Array<Record<string, any>>;
}

export interface InputContent {
  label?: string;
  placeholder?: string;
  inputType?: "text" | "number" | "email" | "password" | "search";
  defaultValue?: string;
}

export interface BadgeContent {
  label: string;
  variant?: "default" | "secondary" | "outline" | "destructive" | "success";
}

export interface DividerContent {
  label?: string;
  orientation?: "horizontal" | "vertical";
}

export type ElementContent =
  | HeadingContent
  | TextContent
  | ButtonContent
  | ImageContent
  | CardContent
  | ContainerContent
  | TableContent
  | InputContent
  | BadgeContent
  | DividerContent
  | Record<string, any>;

export interface ElementStyles {
  // Colors
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  accentColor?: string;
  opacity?: number;

  // Typography
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: string;
  letterSpacing?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";

  // Dimensions
  width?: string;
  height?: string;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;

  // Spacing
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;

  // Borders & Shape
  borderWidth?: string;
  borderStyle?: "none" | "solid" | "dashed" | "dotted" | "double";
  borderRadius?: string;
  boxShadow?: "none" | "sm" | "md" | "lg" | "xl" | "2xl";

  // Alignment & Flex
  display?: "block" | "inline-block" | "flex" | "inline-flex" | "grid";
  flexDirection?: "row" | "row-reverse" | "column" | "column-reverse";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  gap?: string;
  flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
}

export interface ElementLayout {
  position: "static" | "relative" | "absolute";
  order: number;
  visibility: boolean;
  responsive?: {
    hideOnMobile?: boolean;
    hideOnTablet?: boolean;
    hideOnDesktop?: boolean;
  };
}

export interface ElementModel {
  id: string;
  pageId: string;
  parentId: string | null;
  type: ElementType;
  content: Record<string, any>;
  styles: ElementStyles;
  layout: ElementLayout;
  attributes: Record<string, any>;
  locked: boolean;
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  updatedBy: string;
}

export interface PageModel {
  id: string;
  route: string;
  name: string;
  elementIds: string[];
  styles: Record<string, any>;
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Return a page's element references in first-seen order, removing repeated IDs.
 * A duplicate reference must never render the same card/table twice.
 */
export function uniquePageElementIds(ids: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  return (Array.isArray(ids) ? ids : []).filter((id): id is string => {
    if (typeof id !== "string" || !id.trim() || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Generate collision-resistant IDs for new pages and elements, even on rapid repeated clicks. */
export function createStudioId(prefix: string, reservedIds: Iterable<string> = []): string {
  const reserved = new Set(reservedIds);
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const base = `${prefix}_${randomPart}`;
  let candidate = base;
  let suffix = 1;
  while (reserved.has(candidate)) {
    candidate = `${base}_${suffix++}`;
  }
  return candidate;
}

/** Arabic, user-facing names used instead of internal component/type names. */
export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  heading: "عنوان",
  text: "نص وصفي",
  button: "زر وإجراء",
  image: "صورة",
  card: "بطاقة",
  container: "مجموعة عناصر",
  table: "جدول بيانات",
  input: "حقل إدخال",
  badge: "حالة",
  divider: "فاصل",
};

export function getElementDisplayName(element: Pick<ElementModel, "type" | "content">): string {
  const content = element.content || {};
  const value = content.title || content.text || content.label || content.alt || content.placeholder;
  if (typeof value === "string" && value.trim()) {
    return value.trim().replace(/\\s+/g, " ").slice(0, 42);
  }
  return ELEMENT_TYPE_LABELS[element.type] || "عنصر";
}

export interface StudioDomEdit {
  text?: string;
  styles?: Record<string, string>;
  deleted?: boolean;
  duplicateCount?: number;
  order?: number;
}

export interface StudioDraft {
  id: string;
  owner: string;
  baseRevision: number;
  schemaVersion: number;
  pages: Record<string, PageModel>;
  elements: Record<string, ElementModel>;
  domEdits: Record<string, StudioDomEdit>;
  updatedAt: string;
  createdAt: string;
  /** Last server-confirmed draft row timestamp; used to detect writes from other sessions. */
  serverUpdatedAt?: string;
  /** True only when the current browser has edits that were not confirmed by Supabase. */
  hasUnsavedLocalChanges?: boolean;
  hasUnpublishedChanges: boolean;
}

/**
 * Repair only repeated references to the exact same element ID. It deliberately does
 * not delete distinct elements that happen to have similar text or styling.
 */
export function normalizeStudioDraftPageReferences(draft: StudioDraft): {
  draft: StudioDraft;
  changed: boolean;
} {
  let changed = false;
  const pages = Object.fromEntries(
    Object.entries(draft.pages || {}).map(([pageKey, page]) => {
      const originalIds = Array.isArray(page.elementIds) ? page.elementIds : [];
      const elementIds = uniquePageElementIds(originalIds);
      const hasChanged = elementIds.length !== originalIds.length ||
        elementIds.some((id, index) => id !== originalIds[index]);
      if (hasChanged) changed = true;
      return [pageKey, hasChanged ? { ...page, elementIds } : page];
    }),
  );
  return { draft: changed ? { ...draft, pages } : draft, changed };
}

export interface StudioPublishedConfig {
  id?: string;
  revision: number;
  schemaVersion?: number;
  schema_version?: number;
  publishedAt: string;
  publishedBy: string;
  summary: string;
  pages: Record<string, PageModel>;
  elements: Record<string, ElementModel>;
  domEdits: Record<string, StudioDomEdit>;
}

export interface StudioHistoryRecord {
  id?: number | string;
  revision: number;
  schemaVersion: number;
  publishedBy: string;
  publishedAt: string;
  summary: string;
  snapshot: {
    pages: Record<string, PageModel>;
    elements: Record<string, ElementModel>;
    domEdits?: Record<string, StudioDomEdit>;
  };
}

export interface ConflictDetail {
  type: "page_modified" | "element_modified" | "element_deleted" | "revision_gap";
  targetId: string;
  title: string;
  localValue?: any;
  serverValue?: any;
  description: string;
}

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Runtime Validation: Detect cycles in element parent tree
 */
export function detectCycle(
  elementId: string,
  elements: Record<string, ElementModel>,
  visited = new Set<string>(),
): boolean {
  if (visited.has(elementId)) return true;
  visited.add(elementId);

  const el = elements[elementId];
  if (!el || !el.parentId) return false;

  return detectCycle(el.parentId, elements, visited);
}

/**
 * Runtime Validation: Comprehensive element validator
 */
export function validateElement(el: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!el || typeof el !== "object") {
    return { valid: false, errors: ["العنصر غير معرف أو ذو بنية غير صالحة"] };
  }

  const item = el as Partial<ElementModel>;

  if (!item.id || typeof item.id !== "string" || item.id.trim() === "") {
    errors.push("معرف العنصر (id) مفقود أو غير صالح");
  }

  if (!item.pageId || typeof item.pageId !== "string") {
    errors.push("معرف الصفحة (pageId) مفقود");
  }

  const validTypes: ElementType[] = [
    "heading",
    "text",
    "button",
    "image",
    "card",
    "container",
    "table",
    "input",
    "badge",
    "divider",
  ];
  if (!item.type || !validTypes.includes(item.type)) {
    errors.push(`نوع العنصر غير معتمد: ${item.type}`);
  }

  if (!item.content || typeof item.content !== "object") {
    errors.push("محتوى العنصر (content) يجب أن يكون كائناً صحيحاً");
  }

  if (!item.styles || typeof item.styles !== "object") {
    errors.push("تنسيقات العنصر (styles) مفقودة أو غير صالحة");
  }

  if (!item.layout || typeof item.layout !== "object") {
    errors.push("محددات تخطيط العنصر (layout) مفقودة");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Runtime Validation: Validates complete page structure and all children
 */
export function validatePage(
  page: unknown,
  elements: Record<string, ElementModel>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!page || typeof page !== "object") {
    return { valid: false, errors: ["بيانات الصفحة غير صالحة"] };
  }

  const p = page as Partial<PageModel>;

  if (!p.id || typeof p.id !== "string") {
    errors.push("معرف الصفحة (id) مفقود");
  }

  if (!p.route || typeof p.route !== "string" || !p.route.startsWith("/")) {
    errors.push("مسار الصفحة (route) يجب أن يبدأ بـ /");
  }

  if (!p.name || typeof p.name !== "string") {
    errors.push("اسم الصفحة (name) مفقود");
  }

  if (!Array.isArray(p.elementIds)) {
    errors.push("قائمة معرفات العناصر (elementIds) يجب أن تكون مصفوفة");
  } else {
    if (uniquePageElementIds(p.elementIds).length !== p.elementIds.length) {
      errors.push("قائمة عناصر الصفحة تحتوي على معرفات مكررة؛ يجب أن يظهر كل عنصر مرة واحدة فقط.");
    }
    // Check that all elementIds exist
    p.elementIds.forEach((elemId) => {
      if (!elements[elemId]) {
        errors.push(`العنصر #${elemId} مسجل في الصفحة ولكن لا يوجد له كائن في المتجر`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates the complete draft hierarchy, acyclic integrity, and references
 */
export function validateDraftHierarchy(draft: StudioDraft): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.pages || Object.keys(draft.pages).length === 0) {
    errors.push("لا توجد أي صفحات معرّفة في المسودة");
  }

  // Validate all pages and prohibit two page records from claiming the same route.
  const routeOwners = new Map<string, string>();
  Object.entries(draft.pages).forEach(([pageKey, page]) => {
    const pageValidation = validatePage(page, draft.elements);
    errors.push(...pageValidation.errors);

    if (typeof page.route === "string" && page.route.startsWith("/")) {
      const normalizedRoute = (page.route.trim().replace(/\/+$/, "") || "/").toLocaleLowerCase();
      const otherPage = routeOwners.get(normalizedRoute);
      if (otherPage) {
        errors.push(`المسار ${page.route} مكرر بين الصفحتين ${otherPage} و${pageKey}.`);
      } else {
        routeOwners.set(normalizedRoute, pageKey);
      }
    }
  });

  // Validate all elements
  Object.values(draft.elements).forEach((elem) => {
    const elValidation = validateElement(elem);
    errors.push(...elValidation.errors);

    // Verify parentId points to container/card if specified
    if (elem.parentId) {
      const parent = draft.elements[elem.parentId];
      if (!parent) {
        errors.push(`العنصر #${elem.id} يشير إلى عنصر أب غير موجود (${elem.parentId})`);
      } else {
        if (parent.pageId !== elem.pageId) {
          errors.push(`العنصر #${elem.id} مرتبط بأب من صفحة أخرى (${parent.pageId}).`);
        }
        if (!["container", "card"].includes(parent.type)) {
          warnings.push(`العنصر الأب #${elem.parentId} ليس حاوية (container أو card)`);
        }
      }

      // Check cycles
      if (detectCycle(elem.id, draft.elements)) {
        errors.push(`تم اكتشاف دورة هرمية دائرية غير متناسقة في العنصر #${elem.id}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
