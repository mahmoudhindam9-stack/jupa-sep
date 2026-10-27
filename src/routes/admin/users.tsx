import { createFileRoute } from "@tanstack/react-router";
import { UsersPage } from "@/components/admin/UsersPageView";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "المستخدمين والصلاحيات" }] }),
  component: UsersPage,
});
