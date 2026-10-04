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
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    allowedHosts: true,
  },
});
