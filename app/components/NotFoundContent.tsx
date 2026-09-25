import { SearchX } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { getI18n } from "@/src/server/i18n";

export async function NotFoundContent({ home = "/" }: { home?: string }) {
  const { t } = await getI18n();

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-ink-3">
        <SearchX size={26} aria-hidden />
      </span>
      <p className="nums mt-6 text-sm font-bold text-glow">404</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">{t("الصفحة غير موجودة", "Page not found")}</h1>
      <p className="mt-3 text-sm leading-7 text-ink-2">
        {t("الرابط غير صحيح أو الصفحة ما عادت موجودة.", "The link is wrong or the page no longer exists.")}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <LinkButton href={home}>{t("الرجوع للرئيسية", "Go home")}</LinkButton>
        <LinkButton href="/help" variant="secondary">
          {t("مركز المساعدة", "Help centre")}
        </LinkButton>
      </div>
    </div>
  );
}
