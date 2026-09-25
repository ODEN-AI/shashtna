"use client";

import { useEffect } from "react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { Button, LinkButton } from "@/app/ui/Button";
import { ErrorState } from "@/app/ui/States";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <ErrorState
        title={t("صار خطأ غير متوقع", "Something went wrong")}
        description={t("حاول مرة ثانية. إذا تكررت المشكلة تواصل ويا الدعم.", "Please try again. If it keeps happening, contact support.")}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>{t("إعادة المحاولة", "Try again")}</Button>
            <LinkButton href="/help/contact" variant="secondary">
              {t("تواصل ويانا", "Contact us")}
            </LinkButton>
          </div>
        }
      />
    </div>
  );
}
