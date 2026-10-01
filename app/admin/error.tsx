"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { Button, LinkButton } from "@/app/ui/Button";
import { ErrorState } from "@/app/ui/States";

/** Errors thrown when the request never reached the server. */
function isNetworkError(error: Error) {
  return (
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(error.message)
  );
}

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();
  const router = useRouter();
  const network = isNetworkError(error);

  useEffect(() => {
    // Technical detail stays in the log; the admin sees a readable message.
    console.error("ADMIN_ERROR:", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16" data-testid="admin-error">
      <ErrorState
        title={network ? t("تعذر الاتصال بالخادم", "Can't reach the server") : t("حدث خطأ أثناء تحميل البيانات", "Something went wrong loading this page")}
        description={
          <>
            {network
              ? t("تحقق من اتصال الإنترنت وحاول مرة أخرى.", "Check your internet connection and try again.")
              : t("حاول مرة أخرى. إذا تكررت المشكلة تواصل ويا الدعم الفني.", "Please try again. If it keeps happening, contact technical support.")}
            {error.digest ? <span className="nums mt-2 block text-xs text-ink-3">{t("رمز الخطأ", "Error reference")}: {error.digest}</span> : null}
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              onClick={() =>
                startTransition(() => {
                  router.refresh();
                  reset();
                })
              }
            >
              {t("إعادة المحاولة", "Try again")}
            </Button>
            <LinkButton href="/admin" variant="secondary">
              {t("الرئيسية", "Home")}
            </LinkButton>
          </div>
        }
      />
    </div>
  );
}
