import { createFileRoute } from "@tanstack/react-router";
import { AccountsPage } from "@/components/admin/AccountsPageView";

export const Route = createFileRoute("/admin/accounts")({
  head: () => ({ meta: [{ title: "إدارة الحسابات - شجرة ودليل الحسابات المالي" }] }),
  component: AccountsPage,
});
