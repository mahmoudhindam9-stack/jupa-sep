import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin",
    });
  },
  head: () => ({
    meta: [
      { title: "Restocash — لوحة التحكم الرئيسية" },
      {
        name: "description",
        content: "نظام إدارة المطاعم والمحاسبة ERP ونقطة البيع المتكاملة.",
      },
    ],
  }),
  component: IndexRouteComponent,
});

function IndexRouteComponent() {
  return null;
}
