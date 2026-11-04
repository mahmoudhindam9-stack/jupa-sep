import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REAL_SUPABASE_URL = "https://myqtvbfibvgxkqwxvuru.supabase.co";
const REAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cXR2YmZpYnZneGtxd3h2dXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjY0NjgsImV4cCI6MjEwMDQwMjQ2OH0.LDFW826N2GRzG9WnLHgYxoeOcTkDOeLjTiFK6aQ-BSE";

function isPlaceholderUrl(val?: string) {
  if (!val) return true;
  const v = val.trim().toLowerCase();
  return (
    (!v.startsWith("http://") && !v.startsWith("https://")) ||
    v.includes("your-project-id") ||
    v.includes("your_project") ||
    v.includes("example.com") ||
    v.includes("placeholder")
  );
}

function isPlaceholderKey(val?: string) {
  if (!val) return true;
  const v = val.trim();
  return !v.startsWith("eyJ") && !v.startsWith("sb_publishable_") && !v.startsWith("sb_secret_");
}

if (isPlaceholderUrl(process.env.VITE_SUPABASE_URL)) {
  process.env.VITE_SUPABASE_URL = REAL_SUPABASE_URL;
}
if (isPlaceholderUrl(process.env.SUPABASE_URL)) {
  process.env.SUPABASE_URL = REAL_SUPABASE_URL;
}
if (isPlaceholderKey(process.env.VITE_SUPABASE_ANON_KEY)) {
  process.env.VITE_SUPABASE_ANON_KEY = REAL_SUPABASE_ANON_KEY;
}
if (isPlaceholderKey(process.env.VITE_SUPABASE_PUBLISHABLE_KEY)) {
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = REAL_SUPABASE_ANON_KEY;
}

export default defineConfig(({ command }) => ({
  plugins: [
    tanstackStart({
      router: {
        codeSplittingOptions: {
          defaultBehavior: [],
        },
      },
      ...(command === "build"
        ? {
            spa: {
              enabled: true,
              prerender: {
                outputPath: "/index",
                crawlLinks: false,
              },
            },
            prerender: {
              enabled: true,
              autoStaticPathsDiscovery: false,
              crawlLinks: false,
              failOnError: false,
            },
          }
        : {}),
    }),
    react(),
    tailwindcss(),
  ],
  // Keep TanStack Start/Router packages under the Start plugin's dependency
  // resolution. Forcing them into Vite's pre-bundle can create a second router
  // context in hosted previews, leaving StartClient with an undefined router.
  // React and ordinary leaf dependencies may still be optimized normally.
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "lucide-react",
      "sonner",
      "clsx",
      "tailwind-merge",
      "xlsx",
      "recharts",
      "qrcode.react",
      "date-fns",
      "jszip",
      "class-variance-authority",
      "cmdk",
      "vaul",
      "input-otp",
      "embla-carousel-react",
      "react-day-picker",
      "react-hook-form",
      "@hookform/resolvers",
      "react-resizable-panels",
      "zod",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-aspect-ratio",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
    ],
    exclude: [
      "@tanstack/react-start",
      "@tanstack/react-start/client",
      "@tanstack/react-start-client",
      "@tanstack/start-client-core",
      "@tanstack/react-router",
      "@tanstack/router-core",
    ],
  },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "node:async_hooks": path.resolve(__dirname, "./src/shared/services/asyncHooksPolyfill.ts"),
      async_hooks: path.resolve(__dirname, "./src/shared/services/asyncHooksPolyfill.ts"),
    },
  },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("/xlsx/")) return "vendor-xlsx";
            if (id.includes("/recharts/") || id.includes("/d3-")) return "vendor-charts";
            if (id.includes("/jszip/")) return "vendor-jszip";
            if (id.includes("/@supabase/")) return "vendor-supabase";
            if (id.includes("/lucide-react/")) return "vendor-icons";
          }
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    hmr: false,
  },
}));
