"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { Button } from "@/app/ui/Button";
import { Notice } from "@/app/ui/States";
import { announceSessionExpired } from "@/app/ui/session-events";

import { signOutEverywhereAction } from "./actions";

/** Two-step "sign out of all devices"; ends with a full reload to the login page. */
export function SignOutEverywhere() {
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      setError("");
      try {
        const result = await signOutEverywhereAction();

        if (result?.ok) {
          navigator.serviceWorker?.controller?.postMessage("CLEAR_CACHE");
          // Full load: nothing authenticated stays in the client router cache.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/login?redirect=/admin";
          return;
        }

        if (result?.code === "UNAUTHENTICATED") announceSessionExpired();
        setError(result?.message ?? t("تعذر تنفيذ الطلب.", "Couldn't complete the request."));
      } catch {
        setError(t("تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.", "Can't reach the server. Check your connection and try again."));
      }
    });

  return (
    <div className="space-y-3" data-testid="sign-out-everywhere">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-ink-2">{t("متأكد؟ راح تحتاج تسجّل الدخول من جديد بكل جهاز.", "Are you sure? You'll need to sign in again on every device.")}</p>
          <Button variant="danger" size="sm" onClick={run} disabled={pending}>
            {pending ? t("جاري الخروج…", "Signing out…") : t("نعم، اخرج من كل الأجهزة", "Yes, sign out everywhere")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
            {t("إلغاء", "Cancel")}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          <LogOut size={16} aria-hidden />
          {t("تسجيل الخروج من كل الأجهزة", "Sign out of all devices")}
        </Button>
      )}
    </div>
  );
}
