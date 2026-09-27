import { formatPrice, type Lang } from "@/src/lib/i18n";
import type { CatalogDevice, CatalogPackage } from "@/src/server/catalog";

import { Badge } from "./Badge";
import { LinkButton } from "./Button";
import { FactTiles, FeatureChips, PriceBlock, ProductCta, ProductStage } from "./product/Product";

/**
 * A VIP device as a product: large device visual, name, short description,
 * up to four facts from its specification lines (never invented), the plans
 * it works with, price, and the existing device purchase links.
 */
export function DeviceCard({
  device,
  plans,
  lang,
}: {
  device: CatalogDevice;
  plans: CatalogPackage[];
  lang: Lang;
}) {
  const isAr = lang === "ar";
  const compatible = plans.filter((plan) => device.packageIds.includes(plan.id));
  const firstPlan = compatible[0];

  return (
    <article
      data-testid="device-card"
      className="group flex h-full flex-col overflow-hidden rounded-panel border border-line bg-surface/70 shadow-card transition duration-300 [border-top-color:rgb(203_233_253/0.18)] hover:-translate-y-1 hover:border-line-strong"
    >
      <ProductStage
        kind="device"
        imageUrl={device.imageUrl}
        alt={device.name}
        fit="contain"
        className="aspect-[16/11]"
        top={<Badge tone="warning">{isAr ? "جهاز VIP" : "VIP device"}</Badge>}
      />

      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div>
          <h3 className="text-xl font-bold leading-8 text-ink">{device.name}</h3>
          {device.description ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink-2">{device.description}</p> : null}
        </div>
        <FactTiles facts={device.features.slice(0, 4)} />
        {compatible.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-3">{isAr ? "يشتغل مع" : "Works with"}</p>
            <FeatureChips items={compatible.map((plan) => plan.name)} />
          </div>
        ) : null}

        <div className="mt-auto border-t border-line pt-4">
          <PriceBlock amount={device.price} currency={isAr ? "د.ع" : "IQD"} note={isAr ? "سعر الجهاز" : "Device price"} />
        </div>
        <div className="grid gap-2">
          {firstPlan ? (
            <ProductCta
              href={`/checkout?plan=${encodeURIComponent(firstPlan.slug)}&device=${device.id}`}
              label={isAr ? "اطلبه مع باقة VIP" : "Order with a VIP plan"}
              className="w-full"
            />
          ) : null}
          <LinkButton href={`/checkout?device=${device.id}`} variant="ghost" className="w-full">
            {isAr ? "شراء الجهاز فقط" : "Buy the device only"}
            <span className="nums text-xs text-ink-3">{formatPrice(device.price, lang)}</span>
          </LinkButton>
        </div>
      </div>
    </article>
  );
}
