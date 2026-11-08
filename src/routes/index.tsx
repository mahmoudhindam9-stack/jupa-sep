import { createFileRoute, redirect } from "@tanstack/react-router";

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

    const hasStoredUser =
      typeof localStorage !== "undefined" &&
      Boolean(
        localStorage.getItem("restocash_auth_user") ||
          sessionStorage.getItem("restocash_auth_user"),
      );

    throw redirect({
      to: hasStoredUser ? "/admin" : "/login",
    });
  },
  component: () => null,
});
