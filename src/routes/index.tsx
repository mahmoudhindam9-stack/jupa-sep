import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

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
      const hasStoredUser = Boolean(
        localStorage.getItem("restocash_auth_user") ||
          sessionStorage.getItem("restocash_auth_user"),
      );
      void navigate({ to: hasStoredUser ? "/admin" : "/login", replace: true });
    }
  }, [navigate, search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border/90 bg-card p-7 text-center shadow-lg space-y-4">
        <div className="mx-auto h-2 w-12 rounded-full bg-primary/40 animate-pulse" />
        <p className="text-sm font-bold text-foreground">جاري تحويلك إلى النظام…</p>
      </div>
    </div>
  );
}
