import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Chatbot } from "@/components/Chatbot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { translator } from "../shared/services/translationService";
import { createAppSync } from "../shared/services/appSync";
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

function ErrorComponent({ error, reset }: { error: any; reset: () => void }) {
  useEffect(() => {
    // Keep the original route failure visible; error boundaries must not require
    // router context, because router initialization itself can be the failing step.
    console.error("Restocash route error:", error);
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <main className="w-full max-w-lg text-center" aria-labelledby="error-title">
        <p className="text-sm font-bold text-primary">Restocash ERP</p>
        <h1 id="error-title" className="mt-3 text-2xl font-black tracking-tight text-foreground">
          تعذر تحميل الصفحة
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" role="alert" aria-live="polite">
          حدث خطأ غير متوقع. حاول إعادة تحميل الصفحة، وإذا استمرت المشكلة يمكنك العودة إلى الرئيسية.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              // A full reload is safe even when router context is unavailable.
              window.location.reload();
              reset();
            }}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            إعادة المحاولة
          </button>
          <Link
            to="/"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-input bg-background px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            الرئيسية
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
      { name: "theme-color", content: "#07182a" },
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
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
    scripts: [
      {
        // This runs before the client entry is imported, so it can recover if client.tsx itself fails to load.
        children: `try{const k="restocash:chunk-recovery-attempted";const diagnose=(m)=>{const match=m.match(/https?:\/\/[^\s"'<>]+\/src\/client\.tsx(?:\?[^\s"'<>]*)?/);if(!match){console.error("Client entry load failed; no module URL found.",m);return;}const entry=match[0];const seen=new Set();const visited=[];const failures=[];const scan=async(url,depth)=>{if(seen.has(url)||seen.size>=32||depth>3)return;seen.add(url);try{const response=await fetch(url,{cache:"no-store"});const body=await response.text();const info={url,status:response.status,ok:response.ok,contentType:response.headers.get("content-type")};visited.push(info);if(!response.ok){failures.push({...info,body:body.slice(0,1200)});return;}if(depth>=3||!/(javascript|ecmascript)/i.test(info.contentType||""))return;const re=/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;const deps=[];let hit;while((hit=re.exec(body))!==null){try{const dep=new URL(hit[1],url);if(dep.origin===location.origin&&(dep.pathname.startsWith("/src/")||dep.pathname.includes("/node_modules/")||dep.pathname.startsWith("/@id/")||dep.pathname.startsWith("/@fs/")))deps.push(dep.href);}catch(e){}}await Promise.all(deps.map(dep=>scan(dep,depth+1)));}catch(error){failures.push({url,error:String(error)});}};void scan(entry,0).then(()=>console.error("Client entry import graph diagnostics",{entry,visitedModules:visited.length,failedModules:failures,modules:visited})).catch(error=>console.error("Import graph diagnostics crashed",error));};const recover=(r)=>{const m=String(r||"").toLowerCase();if(!m.includes("failed to fetch dynamically imported module")&&!m.includes("error loading dynamically imported module")&&!m.includes("importing a module script failed")&&!m.includes("loading chunk")&&!m.includes("dynamically imported module"))return;try{if(sessionStorage.getItem(k)==="1"){console.error("Client entry still failed after one recovery reload; collecting the underlying Vite response.",m);diagnose(r);return;}sessionStorage.setItem(k,"1");}catch(e){console.error("Client entry failed; session storage is unavailable.",m);diagnose(r);return;}window.location.reload();};window.addEventListener("error",e=>recover(e.message||""));window.addEventListener("unhandledrejection",e=>recover(e.reason?.message||String(e.reason||"")));}catch(e){console.error("Could not install client entry recovery handler.",e);}`,
      },
      {
        children: `try{const s=localStorage.getItem("restocash-theme");if(s==="dark"||(!s&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}`,
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
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
      if (
        stored === "dark" ||
        (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
      ) {
        document.documentElement.classList.add("dark");
      }
    } catch {
      // Ignored: storage unavailable in restricted environment
    }
    try {
      translator.start();
    } catch (e) {
      console.error("Failed to start translator:", e);
    }
    // Unpublished Pro drafts are never read by the real app. Only a confirmed published
    // configuration or the legacy editor's explicitly saved map can be applied here.
    type StudioRuntimeSnapshot = {
      element: HTMLElement;
      styleAttribute: string | null;
      leafTextContent: string | null;
      directTextNodes: Array<{ node: ChildNode; text: string | null }>;
      parent: Node | null;
      nextSibling: Node | null;
    };
    const studioSnapshots = new Map<string, StudioRuntimeSnapshot>();
    const publishedStudioClones = new Set<HTMLElement>();
    let activePublishedStudioEdits: Record<string, any> = {};
    let activeLegacyStudioEdits: Record<string, any> = {};
    let studioObserver: MutationObserver | null = null;

    const isStudioPreserved = (element: Element) => {
      const preserved = '[data-studio-preserve="currency-switcher-tools"], [data-studio-preserve="currency-switcher"]';
      return !!element.closest(preserved) || !!element.querySelector(preserved);
    };

    const rememberStudioOriginal = (selector: string, element: HTMLElement) => {
      const old = studioSnapshots.get(selector);
      if (old?.element === element) return;
      studioSnapshots.set(selector, {
        element,
        styleAttribute: element.getAttribute("style"),
        leafTextContent: element.children.length === 0 ? element.textContent ?? "" : null,
        directTextNodes: element.children.length === 0 ? [] : Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => ({ node, text: node.textContent })),
        parent: element.parentNode,
        nextSibling: element.nextSibling,
      });
    };

    const resetPublishedStudioEdits = () => {
      for (const clone of publishedStudioClones) clone.remove();
      publishedStudioClones.clear();

      for (const snapshot of Array.from(studioSnapshots.values()).reverse()) {
        const element = snapshot.element;
        if (!element.isConnected) continue;
        if (snapshot.leafTextContent !== null) {
          element.textContent = snapshot.leafTextContent;
        } else {
          for (const entry of snapshot.directTextNodes) {
            if (entry.node.parentNode === element) entry.node.textContent = entry.text;
          }
        }
        delete element.dataset.studioTextApplied;
        if (snapshot.styleAttribute === null) element.removeAttribute("style");
        else element.setAttribute("style", snapshot.styleAttribute);
        if (snapshot.parent && element.parentNode === snapshot.parent) {
          const next = snapshot.nextSibling;
          if (next && next.parentNode === snapshot.parent) snapshot.parent.insertBefore(element, next);
          else snapshot.parent.appendChild(element);
        }
      }
      studioSnapshots.clear();
    };

    const applyStudioEdits = (edits: Record<string, any>) => {
      for (const [selector, edit] of Object.entries(edits || {}) as Array<[string, any]>) {
        if (!edit || typeof edit !== "object") continue;
        let element: Element | null = null;
        try { element = document.querySelector(selector); } catch { continue; }
        if (!element || isStudioPreserved(element)) continue;

        const html = element as HTMLElement;
        rememberStudioOriginal(selector, html);
        if (edit.text !== undefined && html.dataset.studioTextApplied !== String(edit.text)) {
          const node = Array.from(html.childNodes).find((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim());
          if (node) node.textContent = String(edit.text);
          else if (!html.children.length) html.textContent = String(edit.text);
          html.dataset.studioTextApplied = String(edit.text);
        }
        if (edit.styles && typeof edit.styles === "object") for (const [key, value] of Object.entries(edit.styles)) {
          if (typeof value !== "string") continue;
          if (key in html.style) (html.style as any)[key] = value;
          // SVG paths often define their own stroke/fill attributes. Mirror published
          // vector styles onto the drawing primitives so icon edits survive reloads.
          if (html.tagName.toLowerCase() === "svg" && ["fill", "stroke", "strokeWidth", "color"].includes(key)) {
            html.querySelectorAll("path,circle,rect,line,polyline,polygon,ellipse").forEach((node) => {
              if (key in (node as HTMLElement).style) ((node as HTMLElement).style as any)[key] = value;
            });
          }
        }
        if (edit.deleted) html.style.display = "none";
        if (typeof edit.order === "number" && html.parentElement) {
          const siblings = Array.from(html.parentElement.children).filter((item) =>
            item !== html && !(item as HTMLElement).dataset.studioCloneOf);
          const currentIndex = Array.from(html.parentElement.children).indexOf(html);
          const targetIndex = Math.max(0, Math.min(edit.order, siblings.length));
          if (targetIndex < currentIndex && siblings[targetIndex]) html.parentElement.insertBefore(html, siblings[targetIndex]);
          else if (targetIndex > currentIndex && siblings[targetIndex]) html.parentElement.insertBefore(html, siblings[targetIndex].nextSibling);
          else if (targetIndex > currentIndex && !siblings[targetIndex]) html.parentElement.appendChild(html);
        }
        const parent = html.parentElement;
        if (parent) {
          const wanted = Math.min(5, Math.max(0, Number(edit.duplicateCount) || 0));
          const present = Array.from(parent.children).filter((item) => (item as HTMLElement).dataset.studioCloneOf === selector).length;
          for (let n = present; n < wanted; n++) {
            const clone = html.cloneNode(true) as HTMLElement;
            clone.removeAttribute("id");
            clone.removeAttribute("data-studio-selected");
            clone.dataset.studioCloneOf = selector;
            publishedStudioClones.add(clone);
            parent.insertBefore(clone, html.nextSibling);
          }
        }
      }
    };

    const refreshLegacyStudioEdits = () => {
      try {
        const stored = JSON.parse(localStorage.getItem("custom_text_map") || "{}");
        activeLegacyStudioEdits = stored && typeof stored === "object" ? stored : {};
      } catch {
        activeLegacyStudioEdits = {};
      }
    };
    const rebuildRuntimeStudioEdits = () => {
      studioObserver?.disconnect();
      resetPublishedStudioEdits();
      applyStudioEdits({ ...activeLegacyStudioEdits, ...activePublishedStudioEdits });
      studioObserver?.observe(document.body, { childList: true, subtree: true });
    };
    const applyPublishedStudioEdits = (config: any) => {
      const remoteEdits = config?.domEdits;
      activePublishedStudioEdits = remoteEdits && typeof remoteEdits === "object" ? remoteEdits : {};
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
    refreshLegacyStudioEdits();
    window.addEventListener("studio_published_updated", publishedHandler);
    window.addEventListener("studio_legacy_edits_updated", legacyEditsUpdatedHandler);
    window.addEventListener("storage", storageHandler);
    void import("@/features/developer-studio/services/studioService")
      .then(({ studioService }) => studioService.getPublishedConfig())
      .then(applyPublishedStudioEdits)
      .catch((error) => console.warn("Published Studio config could not be loaded:", error));

    const studioObserverInstance = new MutationObserver(() => {
      studioObserverInstance.disconnect();
      applyStudioEdits({ ...activeLegacyStudioEdits, ...activePublishedStudioEdits });
      studioObserverInstance.observe(document.body, { childList: true, subtree: true });
    });
    studioObserver = studioObserverInstance;
    studioObserver.observe(document.body, { childList: true, subtree: true });
    const stopAppSync = createAppSync(queryClient);
    return () => {
      studioObserver?.disconnect();
      window.removeEventListener("studio_published_updated", publishedHandler);
      window.removeEventListener("studio_legacy_edits_updated", legacyEditsUpdatedHandler);
      window.removeEventListener("storage", storageHandler);
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
          <Chatbot />
          <ThemeToggle className="fixed bottom-4 left-4 z-50 rounded-full h-14 w-14 shadow-lg bg-background" />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
