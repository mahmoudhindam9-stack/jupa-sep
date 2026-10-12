import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});

if (typeof window !== "undefined") {
  const originalPrint = window.print.bind(window);

  window.print = function () {
    try {
      // Use the native browser print path first.
      const res = document.execCommand("print", false, "");
      if (res) return;
    } catch (error) {
      console.debug("Native print command is unavailable in this preview.", error);
    }

    // Printing is an optional feature. Load its large fallback module only when needed
    // so an error in the print helper cannot prevent the entire app and login screen
    // from loading.
    void import("./shared/utils/printPage")
      .then(({ printCurrentPage }) => printCurrentPage())
      .catch((error) => {
        console.error("Print fallback could not be loaded; using the browser print dialog.", error);
        originalPrint();
      });
  };
}
