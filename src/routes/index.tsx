import { createFileRoute } from "@tanstack/react-router";
import { Route as LoginRoute } from "./login";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Restocash — لوحة التحكم الرئيسية" },
      {
        name: "description",
        content: "نظام إدارة المطاعم والمحاسبة ERP ونقطة البيع المتكاملة.",
      },
    ],
  }),
  component: HomeLogin,
});

function HomeLogin() {
  const Login = LoginRoute.options.component as React.ElementType;
  return <Login />;
}
