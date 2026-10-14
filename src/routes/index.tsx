import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    let authUser: string | null = null;
    if (typeof window !== "undefined") {
      try {
        authUser =
          localStorage.getItem("restocash_auth_user") ||
          sessionStorage.getItem("restocash_auth_user");
      } catch {
        // Storage restricted or unavailable
      }
    }

    throw redirect({
      to: authUser ? "/admin" : "/login",
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
