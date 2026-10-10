import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "إعداد المستخدمين" }] }),
  component: SetupPage,
});

/**
 * Legacy setup used a separate Auth sign-up path and could create unmanaged users.
 * Accounts are now provisioned only through User Management; this route is retained
 * as a safe redirect for old bookmarks.
 */
function SetupPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/login" });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
      <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-black text-foreground">تم إيقاف إعداد المستخدمين القديم</h1>
        <p className="text-sm text-muted-foreground">
          إنشاء الحسابات وإدارة الصلاحيات متاحان من صفحة المستخدمين فقط. سجّل الدخول بحساب موجود للمتابعة.
        </p>
        <Button className="w-full" onClick={() => navigate({ to: "/login" })}>الانتقال إلى تسجيل الدخول</Button>
      </div>
    </div>
  );
}
