import { createFileRoute } from "@tanstack/react-router";
import { erpStore } from "@/shared/services/erpStore";

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
  component: HomeBypassLogin,
});

function HomeBypassLogin() {
  if (typeof window !== "undefined") {
    localStorage.setItem("restocash_auth_user", "admin@restocash.local");
    localStorage.setItem("restocash_user_role", "admin");
    try {
      erpStore.setCurrentUser("admin");
    } catch {
      // ignore
    }
    window.location.replace("/admin");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-lg font-black text-foreground">جاري الانتقال إلى لوحة التحكم...</p>
      </div>
    </div>
  );
}
