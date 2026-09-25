import { Check, Cpu } from "lucide-react";

import { formatPrice, type Lang } from "@/src/lib/i18n";
import type { CatalogDevice, CatalogPackage } from "@/src/server/catalog";

import { Badge } from "./Badge";
import { LinkButton } from "./Button";

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
    <article className="surface flex h-full flex-col overflow-hidden rounded-panel">
      <div className="relative flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-[#12275f] via-[#0b1733] to-[#070d1c]">
        {device.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={device.imageUrl} alt={device.name} loading="lazy" className="h-full w-full object-contain p-6" />
        ) : (
          <Cpu size={56} className="text-brand-ink/60" aria-hidden />
        )}
        <Badge tone="glow" className="absolute start-4 top-4">
          {device.serviceType}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-bold text-ink">{device.name}</h3>
        <p className="nums mt-2 text-xl font-bold text-ink">{formatPrice(device.price, lang)}</p>
        <p className="mt-3 text-sm leading-7 text-ink-2">{device.description}</p>
        {device.features.length ? (
          <ul className="mt-4 space-y-2 border-t border-line pt-4">
            {device.features.slice(0, 6).map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-ink-2">
                <Check size={15} className="mt-1 shrink-0 text-glow" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
        ) : null}
        {compatible.length ? (
          <p className="mt-4 text-xs leading-6 text-ink-3">
            {isAr ? "متوافق مع: " : "Works with: "}
            {compatible.map((plan) => plan.name).join("، ")}
          </p>
        ) : null}
        <div className="mt-auto grid gap-2 pt-6">
          {firstPlan ? (
            <LinkButton href={`/checkout?plan=${encodeURIComponent(firstPlan.slug)}&device=${device.id}`}>
              {isAr ? "اطلبه مع باقة VIP" : "Order with a VIP plan"}
            </LinkButton>
          ) : null}
          <LinkButton href={`/checkout?device=${device.id}`} variant="secondary">
            {isAr ? "شراء الجهاز فقط" : "Buy the device only"}
          </LinkButton>
        </div>
      </div>
    </article>
  );
}
