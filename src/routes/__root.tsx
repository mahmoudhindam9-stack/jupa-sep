import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Chatbot } from "@/components/Chatbot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { translator } from "../shared/services/translationService";
import { createAppSync } from "../shared/services/appSync";
import { studioService } from "@/features/developer-studio/services/studioService";
import { sanitizeStudioDomEditsMap } from "@/features/developer-studio/models/studio.types";
import { setupVisualPermissionsRuntime } from "../shared/services/visualPermissionsEngine";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <main className="w-full max-w-md text-center" aria-labelledby="not-found-title">
        <p className="text-sm font-bold text-primary">Restocash ERP</p>
        <p className="mt-3 text-7xl font-black tracking-tight text-foreground" aria-hidden="true">
          404
        </p>
        <h1 id="not-found-title" className="mt-2 text-xl font-bold text-foreground">
          الصفحة غير موجودة
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          الصفحة التي تبحث عنها غير موجودة أو ربما تم نقلها إلى مكان آخر.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            العودة للرئيسية
          </Link>
        </div>
      </main>
    </div>
  );
}

function isRecoverableRouteError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || "").toLowerCase();
  return (
    msg.includes("error loading dynamically imported module") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("loading chunk") ||
    msg.includes("dynamically imported module") ||
    msg.includes("removechild") ||
    msg.includes("insertbefore") ||
    msg.includes("not a child of this node")
  );
}

function ErrorComponent({ error, reset }: { error: any; reset: () => void }) {
  const isRecoverable = isRecoverableRouteError(error);

  useEffect(() => {
    if (!isRecoverable) {
      if (typeof console !== "undefined" && console.error) {
        console.error("Restocash route error:", error);
      }
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const key = "restocash:error-boundary-chunk-retry";
        const now = Date.now();
        const raw = window.sessionStorage.getItem(key);
        let state = { count: 0, time: 0 };
        if (raw) {
          try {
            state = JSON.parse(raw);
          } catch {
            // ignore
          }
        }
        if (!state.time || now - state.time > 10000) {
          state = { count: 0, time: now };
        }
        if (state.count < 2) {
          state.count += 1;
          state.time = now;
          window.sessionStorage.setItem(key, JSON.stringify(state));
          reset();
        } else if (state.count === 2) {
          state.count += 1;
          state.time = now;
          window.sessionStorage.setItem(key, JSON.stringify(state));
          window.location.reload();
        }
      } catch {
        reset();
      }
    }, 150);

    return () => window.clearTimeout(timer);
  }, [error, isRecoverable, reset]);

  if (isRecoverable) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
        <main className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm font-bold text-foreground">جاري تحديث الصفحة…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <main className="w-full max-w-lg text-center" aria-labelledby="error-title">
        <p className="text-sm font-bold text-primary">Restocash ERP</p>
        <h1 id="error-title" className="mt-3 text-2xl font-black tracking-tight text-foreground">
          تعذر تحميل الصفحة
        </h1>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              try {
                window.sessionStorage.removeItem("restocash:error-boundary-chunk-retry");
              } catch {}
              reset();
              window.location.reload();
            }}
            className="btn-uniform-edit inline-flex min-h-10 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-black shadow-xs transition-colors cursor-pointer"
          >
            إعادة المحاولة
          </button>
          <Link
            to="/admin"
            onClick={() => reset()}
            className="btn-uniform-close inline-flex min-h-10 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-black transition-colors cursor-pointer no-underline"
          >
            الأقسام الرئيسية
          </Link>
        </div>
      </main>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Restocash — نظام إدارة المطاعم والمحاسبة ERP" },
      {
        name: "description",
        content: "نظام Restocash المتكامل لإدارة المطاعم، نقاط البيع، المخزون، الحسابات والخزائن.",
      },
      { name: "author", content: "Restocash ERP" },
      { name: "theme-color", content: "#091526" },
      { property: "og:title", content: "Restocash — نظام إدارة المطاعم والمحاسبة ERP" },
      {
        property: "og:description",
        content: "نظام Restocash المتكامل لإدارة المطاعم، نقاط البيع، المخزون، الحسابات والخزائن.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Restocash — نظام إدارة المطاعم والمحاسبة ERP" },
      {
        name: "twitter:description",
        content: "نظام Restocash المتكامل لإدارة المطاعم، نقاط البيع، المخزون، الحسابات والخزائن.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Readex+Pro:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
    scripts: [
      {
        // This runs before the client entry is imported, so it can recover if client.tsx itself fails to load.
        children: String.raw`try{const k="restocash:chunk-recovery-attempted";const recover=(r,ev)=>{const m=String(r||"").toLowerCase();if(!m.includes("failed to fetch dynamically imported module")&&!m.includes("error loading dynamically imported module")&&!m.includes("importing a module script failed")&&!m.includes("loading chunk")&&!m.includes("dynamically imported module"))return;if(ev&&typeof ev.preventDefault==="function"){ev.preventDefault();}try{const now=Date.now();const raw=sessionStorage.getItem(k);let data={count:0,time:0};if(raw){try{data=JSON.parse(raw);}catch(e){}}if(!data.time||(now-data.time>8000)){data={count:0,time:now};}if(data.count<4){data.count++;data.time=now;sessionStorage.setItem(k,JSON.stringify(data));setTimeout(()=>{window.location.reload();},1000);}else{sessionStorage.removeItem(k);}}catch(e){setTimeout(()=>{window.location.reload();},1000);}};window.addEventListener("error",e=>recover(e.message||"",e));window.addEventListener("unhandledrejection",e=>recover(e.reason?.message||String(e.reason||""),e));}catch(e){}`,
      },
      {
        children: `try{const s=localStorage.getItem("restocash-theme");const darkThemes=["dark","obsidian-4k","midnight-pro","luxury-gold"];const t=s==="dark"?"obsidian-4k":s==="light"?"pearl-4k":(s||"pearl-4k");document.documentElement.setAttribute("data-theme",t);if(darkThemes.includes(t)||(!s&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}`,
      },
      {
        children: `try{const l=localStorage.getItem("app_lang");if(l==="en"){document.documentElement.lang="en";document.documentElement.dir="ltr";}else if(l==="ar"){document.documentElement.lang="ar";document.documentElement.dir="rtl";}}catch(e){}`,
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Only clear the one-reload recovery guard after the app has actually mounted.
    // Clearing it in client.tsx would allow a persistent route-chunk failure to loop.
    try {
      window.sessionStorage.removeItem("restocash:chunk-recovery-attempted");
    } catch {
      // Storage can be unavailable in restricted preview iframes.
    }
    try {
      const stored = localStorage.getItem("restocash-theme");
      const darkThemes = ["dark", "obsidian-4k", "midnight-pro", "luxury-gold"];
      const resolvedTheme =
        stored === "dark"
          ? "obsidian-4k"
          : stored === "light"
            ? "pearl-4k"
            : stored || "pearl-4k";
      document.documentElement.setAttribute("data-theme", resolvedTheme);
      if (
        darkThemes.includes(resolvedTheme) ||
        (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
      ) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {
      // Ignored: storage unavailable in restricted environment
    }
    // A Studio iframe has a draft-specific preview bridge. Skip the global DOM-edit
    // applier there to avoid applying duplicateCount twice.
    if (new URLSearchParams(window.location.search).get("__studio_preview") === "1") {
      const stopAppSync = createAppSync(queryClient);
      return () => {
        stopAppSync?.();
      };
    }

    type StudioRuntimeSnapshot = {
      element: HTMLElement;
      styleAttribute: string | null;
      leafTextContent: string | null;
      directTextNodes: Array<{ node: ChildNode; text: string | null }>;
      parent: Node | null;
      nextSibling: Node | null;
      wasReordered: boolean;
    };
    const studioSnapshots = new Map<string, StudioRuntimeSnapshot>();
    const publishedStudioClones = new Set<HTMLElement>();
    let activePublishedStudioEdits: Record<string, any> = {};
    let activeLegacyStudioEdits: Record<string, any> = {};
    let studioObserver: MutationObserver | null = null;

    const preservedStudioSelector = '[data-studio-preserve], [data-studio-ui-root="true"]';
    const isStudioPreserved = (element: Element) => !!element.closest(preservedStudioSelector);
    const containsStudioPreserved = (element: Element) => !!element.querySelector(preservedStudioSelector);
    const hidesPreservedStudioUi = (edit: any) => {
      if (edit?.deleted) return true;
      const styles = edit?.styles || {};
      return styles.display === "none" ||
        styles.visibility === "hidden" ||
        Number(styles.opacity) === 0 ||
        ["0", "0px"].includes(String(styles.height || "")) ||
        ["0", "0px"].includes(String(styles.width || "")) ||
        ["0", "0px"].includes(String(styles.maxHeight || "")) ||
        ["0", "0px"].includes(String(styles.maxWidth || ""));
    };

    const rememberStudioOriginal = (selector: string, element: HTMLElement) => {
      const old = studioSnapshots.get(selector);
      if (old?.element === element) return;
      studioSnapshots.set(selector, {
        element,
        styleAttribute: element.getAttribute("style"),
        leafTextContent: element.children.length === 0 ? element.textContent ?? "" : null,
        directTextNodes: Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => ({ node, text: node.nodeValue })),
        parent: element.parentNode,
        nextSibling: element.nextSibling,
        wasReordered: false,
      });
    };

    const resetPublishedStudioEdits = () => {
      for (const clone of publishedStudioClones) {
        try {
          clone.remove();
        } catch {}
      }
      publishedStudioClones.clear();

      for (const snapshot of Array.from(studioSnapshots.values()).reverse()) {
        const element = snapshot.element;
        if (!element.isConnected) continue;
        if (snapshot.directTextNodes.length > 0) {
          for (const entry of snapshot.directTextNodes) {
            if (entry.node.parentNode === element) entry.node.nodeValue = entry.text;
          }
        } else if (snapshot.leafTextContent !== null && element.children.length === 0) {
          const textNode = Array.from(element.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
          if (textNode) textNode.nodeValue = snapshot.leafTextContent;
        }
        delete element.dataset.studioTextApplied;
        if (snapshot.styleAttribute === null) element.removeAttribute("style");
        else element.setAttribute("style", snapshot.styleAttribute);
      }
      studioSnapshots.clear();
    };

    const applyStudioEdits = (edits: Record<string, any>) => {
      // Never apply published/legacy DOM edits to the Developer Studio workspace itself
      const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
      if (currentPath.startsWith("/admin/studio")) {
        resetPublishedStudioEdits();
        return;
      }

      const safeEdits = sanitizeStudioDomEditsMap(edits);
      const linkedRenames: Record<string, string> = {};

      // First pass: collect all originalText -> text mappings across all routes
      for (const [selector, edit] of Object.entries(safeEdits) as Array<[string, any]>) {
        if (selector.startsWith("__studio_") || !edit || typeof edit !== "object") continue;
        if (typeof edit.text === "string" && edit.text.trim().length > 0) {
          const newText = edit.text.trim();
          const origFromEdit = typeof edit.originalText === "string" ? edit.originalText.trim() : "";
          if (origFromEdit && origFromEdit.length >= 2 && origFromEdit !== newText) {
            linkedRenames[origFromEdit] = newText;
          }
        }
      }

      for (const [selector, edit] of Object.entries(safeEdits) as Array<[string, any]>) {
        if (selector.startsWith("__studio_")) continue;
        if (!edit || typeof edit !== "object") continue;
        if (edit.pageRoute) {
          const targetRoute = String(edit.pageRoute).split("?")[0].replace(/\/+$/, "") || "/";
          if (targetRoute !== currentPath) continue;
        }
        let element: Element | null = null;
        try { element = document.querySelector(selector); } catch { continue; }
        if (!element || isStudioPreserved(element)) continue;
        if (
          element.hasAttribute("hidden") ||
          element.getAttribute("data-state") === "inactive" ||
          element.getAttribute("role") === "tabpanel"
        ) {
          continue;
        }
        if (containsStudioPreserved(element) && hidesPreservedStudioUi(edit)) continue;

        const html = element as HTMLElement;
        rememberStudioOriginal(selector, html);
        const snap = studioSnapshots.get(selector);
        if (edit.text !== undefined) {
          const snapOrigText =
            (snap?.directTextNodes?.map((d) => d.text || "").join("") || snap?.leafTextContent || "").trim();
          const effectiveOrig = (edit.originalText || snapOrigText || "").trim();
          if (effectiveOrig && effectiveOrig.length >= 2 && effectiveOrig !== String(edit.text).trim()) {
            linkedRenames[effectiveOrig] = String(edit.text).trim();
          }
          if (html.dataset.studioTextApplied !== String(edit.text)) {
            const node =
              Array.from(html.childNodes).find((child) => child.nodeType === Node.TEXT_NODE && child.nodeValue?.trim()) ||
              Array.from(html.childNodes).find((child) => child.nodeType === Node.TEXT_NODE);
            if (node) {
              node.nodeValue = String(edit.text);
              html.dataset.studioTextApplied = String(edit.text);
            }
          }
        }
        if (edit.ariaLabel) html.setAttribute("aria-label", String(edit.ariaLabel));
        if (edit.role) html.setAttribute("role", String(edit.role));
        if (edit.attributes && typeof edit.attributes === "object") {
          for (const [attrKey, attrVal] of Object.entries(edit.attributes)) {
            if (typeof attrVal === "string" && attrVal && !attrKey.toLowerCase().startsWith("on")) {
              try { html.setAttribute(attrKey, attrVal); } catch {}
            }
          }
        }
        if (edit.styles && typeof edit.styles === "object") for (const [key, value] of Object.entries(edit.styles)) {
          if (typeof value !== "string") continue;
          const cssProp = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
          if (value === "") {
            html.style.removeProperty(cssProp);
          } else {
            html.style.setProperty(cssProp, value, "important");
          }
          if (html.tagName.toLowerCase() === "svg" && ["fill", "stroke", "strokeWidth", "color"].includes(key)) {
            html.querySelectorAll("path,circle,rect,line,polyline,polygon,ellipse").forEach((node) => {
              if (value === "") (node as HTMLElement).style.removeProperty(cssProp);
              else (node as HTMLElement).style.setProperty(cssProp, value, "important");
            });
          }
        }
        if (edit.freePosition?.enabled) {
          const posMode = edit.freePosition.mode || "relative";
          html.style.setProperty("position", posMode, "important");
          html.style.setProperty("left", `${Number(edit.freePosition.x) || 0}px`, "important");
          html.style.setProperty("top", `${Number(edit.freePosition.y) || 0}px`, "important");
          if (edit.freePosition.width) {
            html.style.setProperty("width", `${Number(edit.freePosition.width)}px`, "important");
          }
          if (edit.freePosition.height) {
            html.style.setProperty("height", `${Number(edit.freePosition.height)}px`, "important");
          }
          if (edit.freePosition.zIndex !== undefined) {
            html.style.setProperty("z-index", String(edit.freePosition.zIndex), "important");
          }
        }
        if (edit.actionBinding?.actionId) {
          html.dataset.studioActionId = edit.actionBinding.actionId;
          html.dataset.studioActionType = edit.actionBinding.actionType;
          if (edit.actionBinding.targetRoute) {
            html.dataset.studioTargetRoute = edit.actionBinding.targetRoute;
          }
        }
        if (edit.deleted) html.style.setProperty("display", "none", "important");
        if (typeof edit.order === "number") {
          html.style.setProperty("order", String(edit.order), "important");
        }
      }

      // Persist linked text renames for navigationRegistry & propagate across matching headings/links/buttons in DOM
      try {
        const prevRaw = localStorage.getItem("restocash_studio_linked_renames_v1");
        const prevMap = prevRaw ? JSON.parse(prevRaw) : {};
        const mergedRenames = { ...prevMap, ...linkedRenames };
        localStorage.setItem("restocash_studio_linked_renames_v1", JSON.stringify(mergedRenames));
        const renameEntries = Object.entries(mergedRenames).filter(
          ([oldTxt, newTxt]) =>
            typeof oldTxt === "string" &&
            typeof newTxt === "string" &&
            oldTxt.trim().length >= 2 &&
            newTxt.trim().length > 0 &&
            oldTxt.trim() !== newTxt.trim(),
        ) as Array<[string, string]>;

        if (renameEntries.length > 0) {
          const candidates = document.querySelectorAll(
            "h1, h2, h3, h4, h5, h6, a, button, span, [role='menuitem']",
          );
          candidates.forEach((node) => {
            if (isStudioPreserved(node)) return;
            const el = node as HTMLElement;
            for (const child of Array.from(el.childNodes)) {
              if (child.nodeType === Node.TEXT_NODE && child.nodeValue) {
                const trimmed = child.nodeValue.trim();
                for (const [oldTxt, newTxt] of renameEntries) {
                  if (trimmed === oldTxt) {
                    child.nodeValue = child.nodeValue.replace(oldTxt, newTxt);
                  }
                }
              }
            }
          });
        }
      } catch {
        // ignore storage errors
      }
    };

    const normalizeBrokenShiftAuditRenameOnce = () => {
      try {
        const flagKey = "restocash_shift_audit_unified_v2";
        if (localStorage.getItem(flagKey) === "1") return;
        const keysToClean = [
          "restocash_studio_published_v1",
          "restocash_studio_draft_v1",
          "custom_text_map",
          "restocash_studio_linked_renames_v1",
        ];
        for (const key of keysToClean) {
          const raw = localStorage.getItem(key);
          if (!raw || !raw.includes("الرقابة وسجل العمليات")) continue;
          const replaced = raw.replace(/الرقابة وسجل العمليات/g, "تدقيق الورديات وسجل العمليات");
          localStorage.setItem(key, replaced);
        }
        localStorage.setItem(flagKey, "1");
      } catch {
        // ignore storage errors
      }
    };

    const refreshLegacyStudioEdits = () => {
      normalizeBrokenShiftAuditRenameOnce();
      try {
        const stored = JSON.parse(localStorage.getItem("custom_text_map") || "{}");
        activeLegacyStudioEdits = sanitizeStudioDomEditsMap(stored);
      } catch {
        activeLegacyStudioEdits = {};
      }
    };

    const syncStudioInstantCss = (edits: Record<string, any>) => {
      if (typeof document === "undefined") return;
      let styleEl = document.getElementById("studio-instant-hidden-css") as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "studio-instant-hidden-css";
        document.head.appendChild(styleEl);
      }
      const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
      if (currentPath.startsWith("/admin/studio")) {
        styleEl.textContent = "";
        return;
      }
      const deletedSelectors: string[] = [];
      const safeEdits = sanitizeStudioDomEditsMap(edits);
      for (const [selector, edit] of Object.entries(safeEdits)) {
        if (!selector || selector.startsWith("__studio_") || !edit) continue;
        if (edit.pageRoute) {
          const targetRoute = String(edit.pageRoute).split("?")[0].replace(/\/+$/, "") || "/";
          if (targetRoute !== currentPath) continue;
        }
        if (
          edit.deleted === true ||
          edit.hiddenOn?.desktop === true ||
          edit.styles?.display === "none"
        ) {
          deletedSelectors.push(selector);
        }
      }
      if (deletedSelectors.length > 0) {
        styleEl.textContent = `${deletedSelectors.join(",\n")} {\n  display: none !important;\n}`;
      } else {
        styleEl.textContent = "";
      }
    };

    const rebuildRuntimeStudioEdits = () => {
      studioObserver?.disconnect();
      resetPublishedStudioEdits();
      const combined = { ...activeLegacyStudioEdits, ...activePublishedStudioEdits };
      syncStudioInstantCss(combined);
      applyStudioEdits(combined);
      studioObserver?.observe(document.body, { childList: true, subtree: true });
    };
    const applyPublishedStudioEdits = (config: any) => {
      const remoteEdits = config?.domEdits;
      activePublishedStudioEdits = sanitizeStudioDomEditsMap(remoteEdits);
      rebuildRuntimeStudioEdits();
    };
    const publishedHandler = (event: Event) => applyPublishedStudioEdits((event as CustomEvent).detail);
    const legacyEditsUpdatedHandler = () => {
      refreshLegacyStudioEdits();
      rebuildRuntimeStudioEdits();
    };
    const storageHandler = (event: StorageEvent) => {
      if (event.key === "custom_text_map") legacyEditsUpdatedHandler();
    };
    const routeChangeHandler = () => {
      rebuildRuntimeStudioEdits();
    };

    // Synchronously apply instant CSS and runtime edits from local cache immediately (0ms, before paint)
    try {
      const initialLocalConfig = studioService.getImmediateLocalOrDefaultPublishedConfig();
      if (initialLocalConfig?.domEdits) {
        activePublishedStudioEdits = sanitizeStudioDomEditsMap(initialLocalConfig.domEdits);
        syncStudioInstantCss(activePublishedStudioEdits);
      }
      refreshLegacyStudioEdits();
      rebuildRuntimeStudioEdits();
      translator.start();
    } catch (e) {
      console.error("Studio instant initialization notice:", e);
    }

    const studioObserverInstance = new MutationObserver(() => {
      studioObserverInstance.disconnect();
      applyStudioEdits({ ...activeLegacyStudioEdits, ...activePublishedStudioEdits });
      studioObserverInstance.observe(document.body, { childList: true, subtree: true });
    });
    studioObserver = studioObserverInstance;
    if (typeof document !== "undefined" && document.body) {
      studioObserverInstance.observe(document.body, { childList: true, subtree: true });
    }

    // Refresh from remote published configuration in background
    void studioService
      .getPublishedConfig()
      .then(applyPublishedStudioEdits)
      .catch((error) => console.warn("Published Studio config could not be loaded:", error));

    window.addEventListener("studio_published_updated", publishedHandler);
    window.addEventListener("studio_legacy_edits_updated", legacyEditsUpdatedHandler);
    window.addEventListener("storage", storageHandler);
    window.addEventListener("popstate", routeChangeHandler);

    const stopAppSync = createAppSync(queryClient);
    const stopVisualPerms = setupVisualPermissionsRuntime();
    return () => {
      studioObserver?.disconnect();
      window.removeEventListener("studio_published_updated", publishedHandler);
      window.removeEventListener("studio_legacy_edits_updated", legacyEditsUpdatedHandler);
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("popstate", routeChangeHandler);
      stopVisualPerms?.();
      stopAppSync?.();
    };
  }, [queryClient]);
  return (
    <html lang="ar" dir="rtl" translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <QueryClientProvider client={queryClient}>
          <Outlet />
          <Toaster />
          {isClient && <Chatbot />}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
