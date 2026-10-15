import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/admin/developer-studio")({
  head: () => ({ meta: [{ title: "استوديو التطبيق | Restocash" }] }),
  component: LegacyDeveloperStudioRedirect,
});

/**
 * Keep older bookmarks working while routing everyone to the unified studio.
 * The actual app is rendered as the large canvas in /admin/studio.
 */
function LegacyDeveloperStudioRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/admin/studio", replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-6 text-center" dir="rtl">
      <div className="space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
        <h1 className="text-base font-bold text-foreground">جاري فتح استوديو التطبيق</h1>
        <p className="text-sm text-muted-foreground">نحو مساحة العمل الموحدة ذات المعاينة الكبيرة.</p>
      </div>
    </div>
  );
}
