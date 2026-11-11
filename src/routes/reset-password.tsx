import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RestocashLogo } from "@/components/RestocashLogo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "استعادة كلمة المرور" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [checkingLink, setCheckingLink] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    const establishRecoverySession = async () => {
      try {
        const url = new URL(window.location.href);
        const query = url.searchParams;
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const urlError =
          query.get("error_description") ||
          query.get("error") ||
          hash.get("error_description") ||
          hash.get("error");

        if (urlError) {
          throw new Error(decodeURIComponent(urlError.replace(/\+/g, " ")));
        }

        const tokenHash = query.get("token_hash");
        const code = query.get("code");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        // Verify token-hash links explicitly. For PKCE and implicit links, let
        // supabase-js first process the browser URL during getSession(); doing
        // exchangeCodeForSession() before this can race with its automatic
        // callback handling and consume the one-time PKCE code twice.
        if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });
          if (verifyError) throw verifyError;
        }

        const initialSession = await supabase.auth.getSession();
        if (initialSession.error) throw initialSession.error;
        let session = initialSession.data.session;

        // Compatibility fallback for clients that did not auto-detect a URL
        // callback. Only attempt the one-time exchange when no session exists.
        if (!session && code) {
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          session = data.session;
        }

        if (!session && accessToken && refreshToken) {
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) throw setSessionError;
          session = data.session;
        }

        if (!session?.user?.id) {
          throw new Error(
            "رابط الاستعادة غير صالح أو انتهت صلاحيته. ارجع إلى تسجيل الدخول واطلب رابطًا جديدًا.",
          );
        }

        if (!active) return;
        window.history.replaceState({}, document.title, window.location.pathname);
        setRecoveryReady(true);
      } catch (cause: any) {
        if (!active) return;
        const message = String(cause?.message || "");
        const expired =
          /expired|otp_expired|invalid.*token|token.*invalid/i.test(message);
        setError(
          expired
            ? "انتهت صلاحية رابط الاستعادة أو تم استخدامه من قبل. اطلب رابطًا جديدًا."
            : message || "تعذر التحقق من رابط الاستعادة. اطلب رابطًا جديدًا.",
        );
        setRecoveryReady(false);
      } finally {
        if (active) setCheckingLink(false);
      }
    };

    void establishRecoverySession();
    return () => {
      active = false;
    };
  }, []);

  const saveNewPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("كلمة المرور يجب ألا تقل عن 8 أحرف.");
      return;
    }
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setSaving(true);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      if (!data.user?.id) {
        throw new Error("لم تؤكد Supabase تحديث كلمة المرور.");
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      await supabase.auth.signOut().catch(() => undefined);
    } catch (cause: any) {
      setError(cause?.message || "تعذر تحديث كلمة المرور. اطلب رابط استعادة جديدًا وحاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <RestocashLogo size={38} showDeveloper={true} />
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {success ? <ShieldCheck className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {success ? "تم تحديث كلمة المرور" : "إنشاء كلمة مرور جديدة"}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {success
              ? "تم تحديث كلمة المرور في حساب Supabase بنجاح. يمكنك تسجيل الدخول الآن."
              : "أدخل كلمة مرور جديدة لحسابك. سيتم حفظها في Supabase Auth فقط."}
          </p>
        </div>

        {checkingLink ? (
          <p className="rounded-xl bg-muted p-4 text-center text-sm">جارٍ التحقق من رابط الاستعادة…</p>
        ) : success ? (
          <Button className="w-full" onClick={() => navigate({ to: "/login" })}>
            العودة إلى تسجيل الدخول
          </Button>
        ) : recoveryReady ? (
          <form onSubmit={saveNewPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  dir="ltr"
                  className="pl-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  dir="ltr"
                  className="pl-11"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((value) => !value)}
                  className="absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground"
                  aria-label={showConfirm ? "إخفاء التأكيد" : "إظهار التأكيد"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "جارٍ حفظ كلمة المرور…" : "حفظ كلمة المرور الجديدة"}
            </Button>
          </form>
        ) : (
          <>
            {error && (
              <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button className="w-full" onClick={() => navigate({ to: "/login" })}>
              العودة إلى تسجيل الدخول وطلب رابط جديد
            </Button>
          </>
        )}
      </section>
    </main>
  );
}
