import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const distClientDir = path.join(distDir, "client");
const distServerDir = path.join(distDir, "server");
const distPrerenderDir = path.join(distDir, "prerendered");
const outputDir = path.join(rootDir, ".output");
const buildDir = path.join(rootDir, "build");

console.log("[build-complete] Preparing clean SPA build artifacts for Vercel & static hosts...");

// 1. Identify source directory containing freshly generated client index.html and assets
let sourceDir = null;
if (fs.existsSync(distClientDir) && fs.existsSync(path.join(distClientDir, "index.html"))) {
  sourceDir = distClientDir;
} else if (fs.existsSync(distDir) && fs.existsSync(path.join(distDir, "index.html"))) {
  sourceDir = distDir;
}

// 2. Identify assets directory (client assets with js/css)
let assetsDir = null;
if (fs.existsSync(path.join(distClientDir, "assets"))) {
  assetsDir = path.join(distClientDir, "assets");
} else if (fs.existsSync(path.join(distDir, "assets"))) {
  assetsDir = path.join(distDir, "assets");
}

// 3. Read or synthesize SPA index.html
let rootIndexHtmlContent = "";
if (sourceDir) {
  console.log(`[build-complete] Using generated index.html from: ${sourceDir}`);
  rootIndexHtmlContent = fs.readFileSync(path.join(sourceDir, "index.html"), "utf8");
  // Ensure no legacy inline redirect script remains in index.html
  rootIndexHtmlContent = rootIndexHtmlContent.replace(
    /<script>try\{var u=new URLSearchParams\(window\.location\.search\);[\s\S]*?window\.location\.replace\(hasUser\?"\/admin":"\/login"\);\}\}catch\(e\)\{\}<\/script>/g,
    "",
  );
  // Strip SSR $_TSR stream scripts and Suspense comment markers from static index.html
  // so client.tsx mounts cleanly via createRoot on all Vercel SPA routes without hydration mismatch
  const moduleScriptMatch = rootIndexHtmlContent.match(
    /<script\b[^>]*\btype="module"[^>]*\bsrc="[^"]+"[^>]*><\/script>/i,
  );
  if (moduleScriptMatch) {
    rootIndexHtmlContent = rootIndexHtmlContent.replace(
      /<body[^>]*>[\s\S]*?<\/body>/i,
      `<body class="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">${moduleScriptMatch[0]}</body>`,
    );
  }
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
<html lang="ar" dir="rtl" translate="no">
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

// 4. Clean stale top-level dist files (except client/) before flattening dist/client into dist/
if (fs.existsSync(distDir)) {
  for (const entry of fs.readdirSync(distDir)) {
    if (entry === "client") continue;
    fs.rmSync(path.join(distDir, entry), { recursive: true, force: true });
  }
} else {
  fs.mkdirSync(distDir, { recursive: true });
}

// 5. Copy all files and folders from dist/client into dist/ root
if (fs.existsSync(distClientDir)) {
  for (const item of fs.readdirSync(distClientDir)) {
    const srcItem = path.join(distClientDir, item);
    const destItem = path.join(distDir, item);
    // Skip any route-named subdirectories so Vercel rewrites handle all routes cleanly without 308 slash redirects
    if (
      fs.statSync(srcItem).isDirectory() &&
      item !== "assets" &&
      item !== "data" &&
      item !== "icons" &&
      item !== "images"
    ) {
      continue;
    }
    fs.cpSync(srcItem, destItem, { recursive: true, force: true });
  }
}

// 6. Write clean index.html, 404.html, and _redirects at dist/ root
fs.writeFileSync(path.join(distDir, "index.html"), rootIndexHtmlContent, "utf8");
fs.writeFileSync(path.join(distDir, "404.html"), rootIndexHtmlContent, "utf8");
fs.writeFileSync(path.join(distDir, "_redirects"), "/*    /index.html   200\n", "utf8");

// 7. Remove dist/client, dist/server, dist/prerendered, build/, and .output/ so Vercel serves dist/ as a pure static SPA
for (const dirToClean of [distClientDir, distServerDir, distPrerenderDir, outputDir, buildDir]) {
  if (fs.existsSync(dirToClean)) {
    fs.rmSync(dirToClean, { recursive: true, force: true });
  }
}

console.log(
  `[build-complete] Clean SPA build ready in dist/ (${rootIndexHtmlContent.length} bytes index.html).`,
);
