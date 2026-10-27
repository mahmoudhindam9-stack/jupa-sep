import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const distClientDir = path.join(distDir, "client");
const outputPublicDir = path.join(rootDir, ".output", "public");
const buildDir = path.join(rootDir, "build");

console.log("[build-complete] Post-processing build artifacts...");

// 1. Identify source files from dist/client, dist/prerendered, or dist
let sourceDir = null;
if (fs.existsSync(distClientDir) && fs.existsSync(path.join(distClientDir, "index.html"))) {
  sourceDir = distClientDir;
} else if (fs.existsSync(path.join(distDir, "index.html"))) {
  sourceDir = distDir;
}

if (!sourceDir) {
  console.warn("[build-complete] Warning: No index.html found in dist or dist/client.");
} else {
  console.log(`[build-complete] Using source directory: ${sourceDir}`);

  // Targets to populate so artifact uploaders (Vite dist, React build, or Nitro .output/public) never find empty artifacts
  const targets = [distDir, buildDir, outputPublicDir];

  targets.forEach((target) => {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const items = fs.readdirSync(sourceDir);
    items.forEach((item) => {
      const srcItem = path.join(sourceDir, item);
      const destItem = path.join(target, item);
      if (srcItem === destItem) return;
      // Do not copy client dir recursively into dist
      if (item === "client" && target === distDir) return;
      fs.cpSync(srcItem, destItem, { recursive: true, force: true });
    });

    // Ensure _redirects file exists for SPA routing on hosts like Netlify/Cloudflare
    const redirectsFile = path.join(target, "_redirects");
    if (!fs.existsSync(redirectsFile)) {
      fs.writeFileSync(redirectsFile, "/*    /index.html   200\n", "utf8");
    }
  });

  console.log("[build-complete] Successfully mirrored artifacts to dist/, build/, and .output/public/");
}
