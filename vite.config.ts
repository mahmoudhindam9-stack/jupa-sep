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

export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
      },
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
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    hmr: false,
  },
});
