import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
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
              router.invalidate();
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
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    try {
      translator.start();
    } catch (e) {
      console.error("Failed to start translator:", e);
    }
    return createAppSync(queryClient);
  }, [queryClient]);
  return (
    <html lang="ar" translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem("restocash-theme");
                if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                  document.documentElement.classList.add("dark");
                }
              } catch (e) {}
            `,
          }}
        />
        <HeadContent />
      </head>
      <body>
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
