import type { Metadata } from "next";
import { Crown, MonitorSmartphone, QrCode } from "lucide-react";

import { AppCard } from "@/app/ui/AppCard";
import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { Card, CardHeader } from "@/app/ui/Card";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { requireCustomer } from "@/src/server/auth";
import { getActiveApps } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";
import { listSubscriptionsForUser } from "@/src/server/subscriptions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الأجهزة والتطبيقات" };

export default async function DevicesAndAppsPage() {
  const user = await requireCustomer("/account/devices");
  const [{ t, lang }, apps, subscriptions] = await Promise.all([
    getI18n(),
    getActiveApps().catch(() => []),
    listSubscriptionsForUser(user.id),
  ]);
  const vipDevices = subscriptions.filter((subscription) => subscription.serviceType === "VIP" && subscription.deviceId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("الأجهزة والتطبيقات", "Devices & apps")}
        description={t("التطبيقات المناسبة لاشتراكك وأجهزة VIP المرتبطة به.", "The right apps for your subscription and the VIP devices linked to it.")}
      />

      {vipDevices.length ? (
        <Card className="p-6">
          <CardHeader icon={<Crown size={19} aria-hidden />} title={t("أجهزة VIP المرتبطة", "Linked VIP devices")} />
          <ul className="mt-4 divide-y divide-line">
            {vipDevices.map((subscription) => (
              <li key={subscription.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="block font-bold text-ink">{subscription.packageName}</span>
                  <span className="nums font-mono text-xs text-ink-3" dir="ltr">{subscription.deviceId}</span>
                </span>
                <LinkButton href={`/subscriptions/${subscription.id}`} variant="ghost" size="sm">
                  {t("الاشتراك", "Subscription")}
                </LinkButton>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section>
        <h2 className="text-lg font-bold text-ink">{t("التطبيقات", "Apps")}</h2>
        {apps.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} lang={lang} />
            ))}
          </div>
        ) : (
          <EmptyState className="mt-4" compact title={t("ماكو تطبيقات منشورة حاليًا", "No apps are published right now")} />
        )}
      </section>

      <Card className="border-dashed p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t("قريبًا", "Coming soon")}</Badge>
          <h2 className="font-bold text-ink">{t("أجهزتك المتصلة", "Your connected devices")}</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-ink-2">
          {t(
            "راح تكدر تربط Shashtna Player بحسابك برمز QR، وتشوف الأجهزة المتصلة وتفصلها من هنا. هاي الميزة غير متوفرة بعد، فما نعرض أي أجهزة متصلة حاليًا.",
            "You'll be able to link Shashtna Player to your account with a QR code, and see or remove connected devices here. This isn't available yet, so no connected devices are shown.",
          )}
        </p>
        <div className="mt-4 flex gap-3 text-ink-3">
          <QrCode size={22} aria-hidden />
          <MonitorSmartphone size={22} aria-hidden />
        </div>
      </Card>
    </div>
  );
}
