import { ArrowLeft, Cpu } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/app/ui/Button";
import { translator, type Lang } from "@/src/lib/i18n";
import type { CatalogDevice, CatalogPackage } from "@/src/server/catalog";

/**
 * One VIP device on /devices, in the VIP chapter's warm black and champagne
 * (like the homepage device cards and the VIP chapter on /plans): name,
 * description, up to four facts from its specification lines (never
 * invented), the plans it works with, its price once, and the existing
 * device purchase links. The image shows only when the device has one.
 *
 * The shared DeviceCard stays as it is for the admin preview.
 */
export function VipDeviceCard({ device, plans, lang }: { device: CatalogDevice; plans: CatalogPackage[]; lang: Lang }) {
  const t = translator(lang);
  const compatible = plans.filter((plan) => device.packageIds.includes(plan.id));
  const firstPlan = compatible[0];
  const facts = device.features.slice(0, 4);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-panel border border-vip-line bg-vip-soft" data-testid="device-card">
      {device.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={device.imageUrl} alt={device.name} loading="lazy" decoding="async" className="aspect-[16/10] w-full bg-vip-field object-contain p-6" />
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
        <div className="flex items-start gap-3">
          {device.imageUrl ? null : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-vip-line text-vip" aria-hidden>
              <Cpu size={20} />
            </span>
          )}
          <div className="min-w-0">
            <h2 dir="auto" className="text-xl font-bold leading-8 text-vip" data-testid="device-name">
              {device.name}
            </h2>
            {device.description ? (
              <p dir="auto" className="mt-1 line-clamp-2 text-sm leading-6 text-vip-text">
                {device.description}
              </p>
            ) : null}
          </div>
        </div>

        {facts.length ? (
          <ul className="flex flex-wrap gap-2" aria-label={t("المواصفات", "Specifications")}>
            {facts.map((fact) => (
              <li key={fact} dir="auto" className="rounded-lg border border-vip-line px-2.5 py-1 text-sm text-vip-text">
                {fact}
              </li>
            ))}
          </ul>
        ) : null}

        {compatible.length ? (
          <p className="text-sm leading-6 text-vip-text">
            {t("يشتغل مع: ", "Works with: ")}
            {compatible.map((plan, index) => (
              <span key={plan.id}>
                {index ? t("، ", ", ") : null}
                <bdi className="font-semibold text-vip">{plan.name}</bdi>
              </span>
            ))}
          </p>
        ) : null}

        <div className="mt-auto border-t border-vip-line pt-4">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="nums text-[28px] font-black leading-none text-vip" data-testid="device-price">
              {new Intl.NumberFormat("en-US").format(device.price)}
            </span>
            <span className="text-sm font-semibold text-vip-text">{t("د.ع", "IQD")}</span>
            <span className="ms-1 text-sm text-vip-text">· {t("سعر الجهاز", "Device price")}</span>
          </p>
        </div>
        <div className="grid gap-1.5">
          {firstPlan ? (
            <Link
              href={`/checkout?plan=${encodeURIComponent(firstPlan.slug)}&device=${device.id}`}
              className={buttonClass("vip", "md", "w-full md:h-13 md:px-7 md:text-base")}
            >
              {t("اطلبه مع باقة VIP", "Order with a VIP plan")}
              <ArrowLeft size={17} className="ltr:rotate-180" aria-hidden />
            </Link>
          ) : null}
          <Link
            href={`/checkout?device=${device.id}`}
            className="inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold text-vip-text transition-colors hover:bg-vip-field hover:text-vip"
          >
            {t("شراء الجهاز فقط", "Buy the device only")}
          </Link>
        </div>
      </div>
    </article>
  );
}
