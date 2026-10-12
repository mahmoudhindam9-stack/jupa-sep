import { printCurrentPage } from "./shared/utils/printPage";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    const msg = event.message || "";
    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("Loading chunk")
    ) {
      window.location.reload();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason?.message || String(event.reason || "");
    if (
      reason.includes("Failed to fetch dynamically imported module") ||
      reason.includes("Importing a module script failed") ||
      reason.includes("Loading chunk")
    ) {
      window.location.reload();
    }
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
