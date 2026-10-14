import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sanitize malformed environment variables (e.g. if an API key was mistakenly assigned to SUPABASE_URL)
if (
  process.env.VITE_SUPABASE_URL &&
  !process.env.VITE_SUPABASE_URL.startsWith("http://") &&
  !process.env.VITE_SUPABASE_URL.startsWith("https://")
) {
  process.env.VITE_SUPABASE_URL = "https://myqtvbfibvgxkqwxvuru.supabase.co";
}
if (
  process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.startsWith("http://") &&
  !process.env.SUPABASE_URL.startsWith("https://")
) {
  process.env.SUPABASE_URL = "https://myqtvbfibvgxkqwxvuru.supabase.co";
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
  // The hosted preview can restart Vite while preserving a browser page with
  // old optimized-dependency URLs. Force a fresh pre-bundle on each dev-server
  // start and explicitly include the client-critical React/TanStack modules.
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "@tanstack/react-start",
      "@tanstack/react-start/client",
      "@tanstack/react-router",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "lucide-react",
      "sonner",
      "clsx",
      "tailwind-merge",
    ],
    esbuildOptions: {
      plugins: [
        {
          name: "async-hooks-polyfill",
          setup(build) {
            build.onResolve({ filter: /^(node:)?async_hooks$/ }, () => ({
              path: path.resolve(__dirname, "./src/shared/services/asyncHooksPolyfill.ts"),
            }));
          },
        },
      ],
    },
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "node:async_hooks": path.resolve(__dirname, "./src/shared/services/asyncHooksPolyfill.ts"),
      async_hooks: path.resolve(__dirname, "./src/shared/services/asyncHooksPolyfill.ts"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
  },
});
