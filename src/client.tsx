import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { StartClient } from "@tanstack/react-start/client";
import { getRouter } from "./router";

if (typeof window !== "undefined" && !(window as any).$_TSR) {
  const router = getRouter();
  void router.load().finally(() => {
    createRoot(document).render(<RouterProvider router={router} />);
  });
} else {
  hydrateRoot(document, <StartClient />);
}

if (typeof window !== "undefined") {
  try {
    const originalPrint =
      typeof window.print === "function" ? window.print.bind(window) : undefined;

    window.print = function () {
      void import("./shared/utils/printPage")
        .then(({ printCurrentPage }) => printCurrentPage())
        .catch((error) => {
          console.error(
            "Print fallback could not be loaded; using the browser print dialog.",
            error,
          );
          if (originalPrint) originalPrint();
        });
    };
  } catch (err) {
    console.debug("Could not override window.print in this environment:", err);
  }
}

