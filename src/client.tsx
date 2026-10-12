import { printCurrentPage } from "./shared/utils/printPage";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

const CHUNK_RECOVERY_KEY = "restocash:chunk-recovery-attempted";

if (typeof window !== "undefined") {
  // If this entry loaded successfully, a previous recovery attempt is no longer needed.
  try {
    window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
  } catch {
    // Storage can be unavailable in restricted preview iframes.
  }

  const recoverFromChunkLoadFailure = (reason: string) => {
    const isChunkLoadFailure =
      reason.includes("Failed to fetch dynamically imported module") ||
      reason.includes("Importing a module script failed") ||
      reason.includes("Loading chunk");

    if (!isChunkLoadFailure) return;

    // A preview server restart can leave the browser with a stale Vite module URL.
    // Reload at most once per session; otherwise a persistent 404/500 creates a reload loop.
    try {
      if (window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) === "1") {
        console.error(
          "The app entry module still cannot load after one recovery reload. Check the Vite server output for the underlying compile/import error.",
          reason,
        );
        return;
      }
      window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, "1");
    } catch {
      // If storage is blocked, avoid automatic reloads that could loop indefinitely.
      console.error("Module load failed and session storage is unavailable.", reason);
      return;
    }

    window.location.reload();
  };

  window.addEventListener("error", (event) => {
    recoverFromChunkLoadFailure(event.message || "");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason?.message || String(event.reason || "");
    recoverFromChunkLoadFailure(reason);
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});

if (typeof window !== "undefined") {
  const originalPrint = window.print;
  window.print = function () {
    try {
      // Try to execute native print command (might fail silently in sandboxed iframe)
      const res = document.execCommand("print", false, "");
      if (res) return;
    } catch (e) {
      void e;
    }

    console.log("Using robust print fallback...");
    printCurrentPage();
  };
}
