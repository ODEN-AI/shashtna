import type { Metadata } from "next";

import { LinkButton } from "@/app/ui/Button";
import { Container } from "@/app/ui/Page";
import { PlanBoard } from "@/app/ui/PlanBoard";
import { EmptyState, ErrorState, Notice } from "@/app/ui/States";
import { FAQ } from "@/src/content/help";
import { getActiveDevices, getActivePackages, type CatalogDevice, type CatalogPackage } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الباقات",
  description: "باقات شاشتنا IPTV وVIP بأسعار ومدد واضحة. اختار باقتك وأكمل طلبك بخطوات بسيطة.",
  alternates: { canonical: "/plans" },
};

function positiveId(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/** Cheapest active device compatible with each VIP package (display only). */
function cheapestDeviceByPackage(devices: CatalogDevice[]) {
  const cheapest = new Map<number, number>();

  for (const device of devices) {
    for (const packageId of device.packageIds) {
      const current = cheapest.get(packageId);
      if (current === undefined || device.price < current) cheapest.set(packageId, device.price);
    }
  }

  return cheapest;
}

/**
 * The plans page as two chapters: IPTV and VIP are separate services, so
 * each has its own full-width field and its own price board, and they are
 * never shown side by side as if interchangeable.
 */
export default async function PlansPage({ searchParams }: { searchParams: Promise<{ renew?: string; upgrade?: string }> }) {
  const [{ t, lang }, params] = await Promise.all([getI18n(), searchParams]);
  // Renewals and upgrades start on the subscription page and pick the plan
  // here; checkout (which checks ownership) receives both.
  const renewId = positiveId(params.renew);
  const upgradeId = positiveId(params.upgrade);
  const checkoutHref = (pkg: CatalogPackage) =>
    `/checkout?plan=${encodeURIComponent(pkg.slug)}${renewId ? `&renew=${renewId}` : upgradeId ? `&upgrade=${upgradeId}` : ""}`;

  let packages: CatalogPackage[] | null = null;
  let devices: CatalogDevice[] = [];

  try {
    [packages, devices] = await Promise.all([getActivePackages(), getActiveDevices()]);
  } catch (error) {
    console.error("PLANS_PAGE_ERROR:", error);
  }

  const iptv = packages?.filter((pkg) => pkg.serviceType === "IPTV") ?? [];
  const vip = packages?.filter((pkg) => pkg.serviceType === "VIP") ?? [];
  const paymentFaq = FAQ.filter((item) => item.topic === "payment" || item.id === "activation");

  return (
    <>
      <Container className="pb-10 pt-10 sm:pb-14 sm:pt-16">
        <h1 className="max-w-3xl text-balance text-poster font-black text-ink">{t("اختار خدمتك أولًا", "Pick your service first")}</h1>
        <p className="mt-5 max-w-2xl text-lead text-ink-2">
          {t(
            "عدنا خدمتين منفصلتين: IPTV تشتغل على جهازك الحالي، وVIP تجي ويا جهاز مخصص. كل الأسعار بالدينار العراقي، والسعر اللي تشوفه هو اللي تحوّله.",
            "We offer two separate services: IPTV runs on the device you already have, and VIP comes with a dedicated device. All prices are in Iraqi dinars, and the price you see is what you transfer.",
          )}
        </p>
        {renewId || upgradeId ? (
          <Notice tone="info" className="mt-6 max-w-xl">
            {upgradeId
              ? t("اختار الباقة الجديدة لترقية اشتراكك.", "Choose the new plan for your upgrade.")
              : t("اختار مدة التجديد لاشتراكك.", "Choose the renewal plan for your subscription.")}
          </Notice>
        ) : null}
        {iptv.length && vip.length ? (
          <nav className="mt-8 flex flex-wrap gap-3" aria-label={t("الخدمات", "Services")}>
            <a href="#iptv" className="inline-flex h-12 items-center rounded-xl bg-iptv px-5 text-sm font-bold text-white transition-colors hover:bg-iptv-deep">
              {t("IPTV على جهازك", "IPTV on your device")}
            </a>
            <a href="#vip" className="inline-flex h-12 items-center rounded-xl border border-vip-line bg-vip-field px-5 text-sm font-bold text-vip transition-colors hover:bg-vip-soft">
              {t("VIP ويا جهاز", "VIP with a device")}
            </a>
          </nav>
        ) : null}
      </Container>

      {packages === null ? (
        <Container className="pb-16">
          <ErrorState
            title={t("تعذر تحميل الباقات", "Plans couldn't be loaded")}
            description={t("صار خطأ مؤقت. حدّث الصفحة بعد شوية.", "A temporary error occurred. Refresh the page shortly.")}
            action={<LinkButton href="/plans" variant="secondary">{t("إعادة المحاولة", "Try again")}</LinkButton>}
          />
        </Container>
      ) : packages.length === 0 ? (
        <Container className="pb-16">
          <EmptyState
            title={t("ماكو باقات منشورة حاليًا", "No plans are published right now")}
            description={t("راح تظهر الباقات هنا أول ما تنشر.", "Plans will appear here as soon as they're published.")}
            action={<LinkButton href="/help/contact" variant="secondary">{t("تواصل ويانا", "Contact us")}</LinkButton>}
          />
        </Container>
      ) : (
        <>
          {iptv.length ? (
            <section id="iptv" aria-labelledby="iptv-heading" className="scroll-mt-16 bg-iptv py-14 text-white sm:py-20">
              <Container>
                <h2 id="iptv-heading" className="text-[length:clamp(3rem,2rem+5vw,6rem)] font-black leading-none">IPTV</h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-iptv-ink">
                  {t(
                    "قنوات وأفلام ومسلسلات على التلفزيون أو الموبايل اللي عندك. بعد التفعيل تستلم اسم مستخدم وكلمة مرور بحسابك.",
                    "Channels, films and series on the TV or phone you already have. After activation you get a username and password in your account.",
                  )}
                </p>
                <div className="mt-8">
                  <PlanBoard packages={iptv} lang={lang} service="IPTV" hrefFor={checkoutHref} />
                </div>
              </Container>
            </section>
          ) : null}

          {vip.length ? (
            <section id="vip" aria-labelledby="vip-heading" className="scroll-mt-16 bg-vip-field py-14 sm:py-20">
              <Container>
                <h2 id="vip-heading" className="text-[length:clamp(3rem,2rem+5vw,6rem)] font-black leading-none text-vip">VIP</h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-vip-text">
                  {t(
                    "باقة ويا جهاز VIP مخصص تختاره عند الطلب. سعر الطلب يشمل الباقة والجهاز، والتجديد بعدين بدون جهاز.",
                    "A plan with a dedicated VIP device you pick when ordering. The order covers the plan and the device; later renewals need no device.",
                  )}
                </p>
                <div className="mt-8">
                  <PlanBoard packages={vip} lang={lang} service="VIP" hrefFor={checkoutHref} devicesFrom={cheapestDeviceByPackage(devices)} />
                </div>
              </Container>
            </section>
          ) : null}

          <Container className="py-16 sm:py-20">
            <h2 className="text-h2 font-bold text-ink">{t("الدفع والتفعيل", "Payment and activation")}</h2>
            <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-3">
              {paymentFaq.map((item) => (
                <div key={item.id}>
                  <h3 className="text-base font-bold text-ink">{item.q[lang]}</h3>
                  <p className="mt-2 text-sm leading-7 text-ink-2">{item.a[lang]}</p>
                </div>
              ))}
            </div>
          </Container>
        </>
      )}
    </>
  );
}
