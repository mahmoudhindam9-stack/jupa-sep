import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/admin/ReportsPageView";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "التقارير المالية والتحليلات" }] }),
  component: ReportsPage,
});
