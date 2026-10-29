import { useEffect } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

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
  beforeLoad: ({ search }) => {
    if (typeof window === "undefined") {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const page = search.page || urlParams.get("page") || undefined;
    const selfOrder = search.selfOrder || urlParams.get("selfOrder") || undefined;
    const table = search.table || urlParams.get("table") || undefined;
    const tableId = search.tableId || urlParams.get("tableId") || undefined;
    const table_id = search.table_id || urlParams.get("table_id") || undefined;
    const tableName = search.tableName || urlParams.get("tableName") || undefined;
    const zone = search.zone || urlParams.get("zone") || undefined;
    const currency = search.currency || urlParams.get("currency") || undefined;
    const lang = search.lang || urlParams.get("lang") || undefined;
    const allowLangSwitch =
      search.allowLangSwitch || urlParams.get("allowLangSwitch") || undefined;
    const welcome = search.welcome || urlParams.get("welcome") || undefined;

    const isMenuQrRedirect =
      page === "menu" ||
      selfOrder === "1" ||
      Boolean(tableId || table_id || table);

    if (isMenuQrRedirect) {
      throw redirect({
        to: "/menu",
        search: {
          table,
          tableId,
          table_id,
          tableName,
          zone,
          currency,
          lang,
          allowLangSwitch,
          welcome,
        },
      });
    }

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
  const navigate = useNavigate();
  const search = Route.useSearch();

  useEffect(() => {
    const isMenuQrRedirect =
      search.page === "menu" ||
      search.selfOrder === "1" ||
      Boolean(search.tableId || search.table_id || search.table);

    if (isMenuQrRedirect) {
      void navigate({
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
        replace: true,
      });
    } else {
      void navigate({ to: "/admin", replace: true });
    }
  }, [navigate, search]);

  return null;
}
