import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { translator, type Lang } from "@/src/lib/i18n";
import type { CatalogDevice, CatalogPackage } from "@/src/server/catalog";

import d from "./devices.module.css";

/**
 * One VIP device on /devices, as a product card in the VIP chapter's gold:
 * picture, name, description, up to four facts from its specification lines
 * (never invented), the plans it works with, its price once, and the
 * existing device purchase links. A device without a picture of its own
 * shows Shashtna's VIP art.
 *
 * The shared DeviceCard stays as it is for the admin preview.
 */
export function VipDeviceCard({ device, plans, lang, vipArt }: { device: CatalogDevice; plans: CatalogPackage[]; lang: Lang; vipArt: string }) {
  const t = translator(lang);
  const compatible = plans.filter((plan) => device.packageIds.includes(plan.id));
  const firstPlan = compatible[0];
  const facts = device.features.slice(0, 4);

  return (
    <article className={d.card} data-testid="device-card">
      <div className={d.art}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={device.imageUrl ?? vipArt}
          alt={device.imageUrl ? device.name : ""}
          loading="lazy"
          decoding="async"
          className={device.imageUrl ? d.artOwn : d.artFallback}
        />
        <span className={d.tag}>VIP</span>
      </div>

      <div className={d.body}>
        <div>
          <h2 dir="auto" className={d.name} data-testid="device-name">
            {device.name}
          </h2>
          {device.description ? (
            <p dir="auto" className={`${d.desc} line-clamp-2`}>
              {device.description}
            </p>
          ) : null}
        </div>

        {facts.length ? (
          <ul className={d.specs} aria-label={t("المواصفات", "Specifications")}>
            {facts.map((fact) => (
              <li key={fact} dir="auto">
                {fact}
              </li>
            ))}
          </ul>
        ) : null}

        {compatible.length ? (
          <p className={d.works}>
            {t("يشتغل مع: ", "Works with: ")}
            {compatible.map((plan, index) => (
              <span key={plan.id}>
                {index ? t("، ", ", ") : null}
                <bdi>{plan.name}</bdi>
              </span>
            ))}
          </p>
        ) : null}

        <p className={d.foot}>
          <span className={`${d.price} nums`} data-testid="device-price">
            {new Intl.NumberFormat("en-US").format(device.price)}
          </span>
          <span className={d.priceUnit}>{t("د.ع", "IQD")}</span>
          <span className={d.priceNote}>· {t("سعر الجهاز", "Device price")}</span>
        </p>

        <div className={d.actions}>
          {firstPlan ? (
            <Link href={`/checkout?plan=${encodeURIComponent(firstPlan.slug)}&device=${device.id}`} className={`${d.btn} ${d.btnGold}`}>
              {t("اطلبه مع باقة VIP", "Order with a VIP plan")}
              <ArrowLeft size={18} className="ltr:rotate-180" aria-hidden />
            </Link>
          ) : null}
          <Link href={`/checkout?device=${device.id}`} className={`${d.btn} ${d.btnGhost}`}>
            {t("شراء الجهاز فقط", "Buy the device only")}
          </Link>
        </div>
      </div>
    </article>
  );
}
