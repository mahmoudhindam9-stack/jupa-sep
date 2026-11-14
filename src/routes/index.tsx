import { createFileRoute, redirect } from "@tanstack/react-router";
import { isUrlPasswordRecoveryCallback } from "@/features/auth/services/managedUserValidation";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: search.page ? String(search.page) : undefined,
    selfOrder: search.selfOrder ? String(search.selfOrder) : undefined,
    table: search.table !== undefined ? String(search.table) : undefined,
    tableId: search.tableId ? String(search.tableId) : undefined,
    table_id: search.table_id ? String(search.table_id) : undefined,
    tableName: search.tableName ? String(search.tableName) : undefined,
    zone: search.zone ? String(search.zone) : undefined,
    currency: search.currency ? String(search.currency) : undefined,
    lang: search.lang ? String(search.lang) : undefined,
    allowLangSwitch:
      search.allowLangSwitch !== undefined ? String(search.allowLangSwitch) : undefined,
    welcome: search.welcome ? String(search.welcome) : undefined,
    type: search.type ? String(search.type) : undefined,
    token_hash: search.token_hash ? String(search.token_hash) : undefined,
    code: search.code ? String(search.code) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Restocash — لوحة التحكم الرئيسية" },
      {
        name: "description",
        content: "نظام إدارة المطاعم والمحاسبة ERP ونقطة البيع المتكاملة.",
      },
    ],
  }),
  beforeLoad: ({ search }) => {
    if (
      search.type === "recovery" ||
      Boolean(search.token_hash) ||
      (typeof window !== "undefined" && isUrlPasswordRecoveryCallback())
    ) {
      if (typeof window !== "undefined") {
        window.location.replace(
          `/reset-password${window.location.search || ""}${window.location.hash || ""}`,
        );
      }
      throw redirect({ to: "/reset-password" });
    }

    const isMenuQrRedirect =
      search.page === "menu" ||
      search.selfOrder === "1" ||
      Boolean(search.tableId || search.table_id || search.table);

    if (isMenuQrRedirect) {
      throw redirect({
        to: "/menu",
        search: {
          table: search.table,
          tableId: search.tableId,
          table_id: search.table_id,
          tableName: search.tableName,
          zone: search.zone,
          currency: search.currency,
          lang: search.lang,
          allowLangSwitch: search.allowLangSwitch,
          welcome: search.welcome,
        },
      });
    }

    // Always enter through the login route. It restores a valid Supabase
    // session itself; a stale local identifier must never bypass the login screen.
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
