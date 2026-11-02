import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const distClientDir = path.join(distDir, "client");
const distPrerenderDir = path.join(distDir, "prerendered");
const outputPublicDir = path.join(rootDir, ".output", "public");
const outputDir = path.join(rootDir, ".output");
const buildDir = path.join(rootDir, "build");

console.log("[build-complete] Post-processing build artifacts...");

// 1. Identify source files containing index.html
const candidateDirs = [
  distClientDir,
  outputPublicDir,
  distPrerenderDir,
  distDir,
  outputDir,
  buildDir,
];

let sourceDir = null;
for (const dir of candidateDirs) {
  if (fs.existsSync(dir) && fs.existsSync(path.join(dir, "index.html"))) {
    try {
      const stat = fs.statSync(path.join(dir, "index.html"));
      if (stat.size > 50) {
        sourceDir = dir;
        break;
      }
    } catch {
      // ignore
    }
  }
}

// 2. Identify assets directory (client assets with js/css)
let assetsDir = null;
const candidateAssetDirs = [
  path.join(distClientDir, "assets"),
  path.join(distDir, "assets"),
  path.join(outputPublicDir, "assets"),
  path.join(buildDir, "assets"),
];
for (const dir of candidateAssetDirs) {
  if (fs.existsSync(dir)) {
    try {
      if (fs.readdirSync(dir).length > 0) {
        assetsDir = dir;
        break;
      }
    } catch {
      // ignore
    }
  }
}

// 3. Fallback: If no index.html exists anywhere, synthesize a valid production SPA index.html
let rootIndexHtmlContent = "";
if (sourceDir) {
  console.log(`[build-complete] Found index.html in: ${sourceDir}`);
  rootIndexHtmlContent = fs.readFileSync(path.join(sourceDir, "index.html"), "utf8");
} else {
  console.warn(
    "[build-complete] No index.html found. Synthesizing valid SPA index.html from bundle assets...",
  );
  let jsScriptTag = "";
  let cssLinkTag = "";

  if (assetsDir) {
    const assetFiles = fs.readdirSync(assetsDir);
    const mainJs =
      assetFiles.find((f) => f.startsWith("index-") && f.endsWith(".js")) ||
      assetFiles.find((f) => f.endsWith(".js") && !f.includes("chunk"));
    const mainCss = assetFiles.find((f) => f.endsWith(".css"));

    if (mainJs) {
      jsScriptTag = `<script type="module" src="/assets/${mainJs}"></script>`;
    }
    if (mainCss) {
      cssLinkTag = `<link rel="stylesheet" href="/assets/${mainCss}" />`;
    }
  }

  rootIndexHtmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Restocash — نظام إدارة المطاعم والمحاسبة ERP</title>
  <meta name="description" content="نظام Restocash المتكامل لإدارة المطاعم، نقاط البيع، المخزون، الحسابات والخزائن." />
  <link rel="icon" href="/favicon.ico" type="image/x-icon" />
  ${cssLinkTag}
</head>
<body>
  <div id="root"></div>
  ${jsScriptTag}
</body>
</html>`;
}

// 4. Targets to populate so artifact uploaders (Vite dist, React build, or Nitro .output/public) always find complete, valid artifacts
const targets = [distDir, distClientDir, buildDir, outputPublicDir];

// Key SPA entry routes that must resolve with HTTP 200 on static hosts
const spaRouteDirs = [
  "menu",
  "captain",
  "pos",
  "oven",
  "login",
  "admin",
  "cashier-treasury",
  "setup",
];

targets.forEach((target) => {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  // Ensure assets exist in target
  const targetAssetsDir = path.join(target, "assets");
  if (assetsDir && targetAssetsDir !== assetsDir) {
    if (!fs.existsSync(targetAssetsDir)) {
      fs.mkdirSync(targetAssetsDir, { recursive: true });
    }
    const assetItems = fs.readdirSync(assetsDir);
    assetItems.forEach((item) => {
      const srcItem = path.join(assetsDir, item);
      const destItem = path.join(targetAssetsDir, item);
      if (srcItem !== destItem) {
        fs.cpSync(srcItem, destItem, { recursive: true, force: true });
      }
    });
  }

  // If sourceDir had other files (like icons, data, etc.), mirror them
  if (sourceDir && sourceDir !== target) {
    const items = fs.readdirSync(sourceDir);
    items.forEach((item) => {
      if (item === "client" || item === "server" || item === "assets") return;
      const srcItem = path.join(sourceDir, item);
      const destItem = path.join(target, item);
      if (srcItem !== destItem) {
        fs.cpSync(srcItem, destItem, { recursive: true, force: true });
      }
    });
  }

  // Write index.html
  const targetIndexHtml = path.join(target, "index.html");
  fs.writeFileSync(targetIndexHtml, rootIndexHtmlContent, "utf8");

  // Write 404.html
  const target404 = path.join(target, "404.html");
  fs.writeFileSync(target404, rootIndexHtmlContent, "utf8");

  // Write _redirects for Netlify / Cloudflare Pages / Static hosts
  const redirectsFile = path.join(target, "_redirects");
  fs.writeFileSync(redirectsFile, "/*    /index.html   200\n", "utf8");

  // Populate key SPA route directories
  spaRouteDirs.forEach((routeDir) => {
    const routePath = path.join(target, routeDir);
    if (!fs.existsSync(routePath)) {
      fs.mkdirSync(routePath, { recursive: true });
    }
    const routeIndex = path.join(routePath, "index.html");
    fs.writeFileSync(routeIndex, rootIndexHtmlContent, "utf8");
  });
});

console.log(
  `[build-complete] Successfully mirrored build artifacts (${rootIndexHtmlContent.length} bytes index.html) to dist/, dist/client/, build/, and .output/public/`,
);
