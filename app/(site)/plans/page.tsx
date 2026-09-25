import type { Metadata } from "next";
import { Crown, Info, Tv } from "lucide-react";

import { LinkButton } from "@/app/ui/Button";
import { PackageCard } from "@/app/ui/PackageCard";
import { Container, Eyebrow, SectionHeading } from "@/app/ui/Page";
import { EmptyState, ErrorState, Notice } from "@/app/ui/States";
import { FAQ } from "@/src/content/help";
import { formatPrice } from "@/src/lib/i18n";
import { getActivePackages, type CatalogPackage } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الباقات",
  description: "باقات شاشتنا IPTV وVIP بأسعار ومدد واضحة. اختار باقتك وأكمل طلبك بخطوات بسيطة.",
  alternates: { canonical: "/plans" },
};

export default async function PlansPage() {
  const { t, lang } = await getI18n();

  let packages: CatalogPackage[] | null = null;

  try {
    packages = await getActivePackages();
  } catch (error) {
    console.error("PLANS_PAGE_ERROR:", error);
  }

  const groups = packages
    ? [
        {
          key: "iptv",
          icon: <Tv size={20} aria-hidden />,
          title: t("باقات IPTV", "IPTV plans"),
          description: t(
            "قنوات رياضية وترفيهية وأفلام ومسلسلات عبر الإنترنت، تستخدمها على جهازك والتطبيق المناسب إلك. بعد التفعيل تستلم اسم مستخدم وكلمة مرور بحسابك.",
            "Sports and entertainment channels, films and series online, on your own device and app. After activation you get a username and password in your account.",
          ),
          items: packages.filter((pkg) => pkg.serviceType === "IPTV"),
        },
        {
          key: "vip",
          icon: <Crown size={20} aria-hidden />,
          title: t("باقات VIP", "VIP plans"),
          description: t(
            "تجربة مشاهدة مميزة مع جهاز VIP مخصص. عند الطلب تختار الجهاز المتوافق، وسعر الطلب يشمل الباقة والجهاز.",
            "A premium experience with a dedicated VIP device. When ordering you pick a compatible device, and the order price covers the plan and the device.",
          ),
          items: packages.filter((pkg) => pkg.serviceType === "VIP"),
        },
      ]
    : [];

  const paymentFaq = FAQ.filter((item) => item.topic === "payment" || item.id === "activation");

  return (
    <>
      <section className="bg-cinema border-b border-line">
        <Container className="py-14 text-center sm:py-20">
          <Eyebrow>{t("باقات شاشتنا", "Shashtna plans")}</Eyebrow>
          <h1 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-bold leading-tight text-ink sm:text-5xl">
            {t("اختار الاشتراك المناسب إلك", "Choose the subscription that fits you")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-8 text-ink-2">
            {t(
              "كل الأسعار بالدينار العراقي وواضحة قبل الطلب. الدفع يتم بالتنسيق ويا فريقنا بعد إرسال الطلب.",
              "All prices are in Iraqi dinars and shown before you order. Payment is arranged with our team after you submit the order.",
            )}
          </p>
          {packages && packages.length ? (
            <nav className="mt-8 flex justify-center gap-2" aria-label={t("أنواع الباقات", "Plan types")}>
              {groups
                .filter((group) => group.items.length)
                .map((group) => (
                  <LinkButton key={group.key} href={`#${group.key}`} variant="secondary" size="sm">
                    {group.icon}
                    {group.title}
                  </LinkButton>
                ))}
            </nav>
          ) : null}
        </Container>
      </section>

      <Container className="py-14">
        {packages === null ? (
          <ErrorState
            title={t("تعذر تحميل الباقات", "Plans couldn't be loaded")}
            description={t("صار خطأ مؤقت. حدّث الصفحة بعد شوية.", "A temporary error occurred. Refresh the page shortly.")}
            action={<LinkButton href="/plans" variant="secondary">{t("إعادة المحاولة", "Try again")}</LinkButton>}
          />
        ) : packages.length === 0 ? (
          <EmptyState
            title={t("ماكو باقات منشورة حاليًا", "No plans are published right now")}
            description={t("راح تظهر الباقات هنا أول ما تنشر.", "Plans will appear here as soon as they're published.")}
            action={<LinkButton href="/help/contact" variant="secondary">{t("تواصل ويانا", "Contact us")}</LinkButton>}
          />
        ) : (
          <div className="space-y-20">
            {groups
              .filter((group) => group.items.length)
              .map((group) => (
                <section key={group.key} id={group.key} className="scroll-mt-24">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface-2 text-glow">
                      {group.icon}
                    </span>
                    <div>
                      <h2 className="text-2xl font-bold text-ink sm:text-3xl">{group.title}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-2">{group.description}</p>
                    </div>
                  </div>
                  <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((pkg) => (
                      <PackageCard
                        key={pkg.id}
                        pkg={pkg}
                        lang={lang}
                        maxFeatures={8}
                        href={`/checkout?plan=${encodeURIComponent(pkg.slug)}`}
                      />
                    ))}
                  </div>
                </section>
              ))}

            <section aria-labelledby="compare-heading">
              <SectionHeading
                eyebrow={t("المقارنة", "Compare")}
                title={<span id="compare-heading">{t("كل الباقات جنب بعض", "All plans side by side")}</span>}
              />
              <div className="surface mt-8 overflow-x-auto rounded-card">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-ink-3">
                      <th scope="col" className="px-4 py-3 text-start font-semibold">{t("الباقة", "Plan")}</th>
                      <th scope="col" className="px-4 py-3 text-start font-semibold">{t("النوع", "Type")}</th>
                      <th scope="col" className="px-4 py-3 text-start font-semibold">{t("المدة", "Duration")}</th>
                      <th scope="col" className="px-4 py-3 text-start font-semibold">{t("السعر", "Price")}</th>
                      <th scope="col" className="px-4 py-3 text-start font-semibold">{t("جهاز VIP", "VIP device")}</th>
                      <th scope="col" className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => (
                      <tr key={pkg.id} className="border-b border-line/70 last:border-0">
                        <th scope="row" className="px-4 py-3.5 text-start font-bold text-ink">{pkg.name}</th>
                        <td className="px-4 py-3.5 text-ink-2">{pkg.serviceType}</td>
                        <td className="px-4 py-3.5 text-ink-2">{pkg.durationLabel}</td>
                        <td className="nums px-4 py-3.5 font-semibold text-ink">{formatPrice(pkg.price, lang)}</td>
                        <td className="px-4 py-3.5 text-ink-2">
                          {pkg.serviceType === "VIP" ? t("مطلوب — يُختار عند الطلب", "Required — chosen at checkout") : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-end">
                          <LinkButton href={`/checkout?plan=${encodeURIComponent(pkg.slug)}`} size="sm" variant="secondary">
                            {t("اختيار", "Choose")}
                          </LinkButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Notice tone="info" className="mt-4">
                <span className="inline-flex items-start gap-2">
                  <Info size={16} className="mt-1 shrink-0" aria-hidden />
                  {t(
                    "سعر باقات VIP الظاهر للباقة فقط؛ عند الطلب ينضاف سعر جهاز VIP اللي تختاره.",
                    "VIP prices shown are for the plan only; the price of the VIP device you choose is added at checkout.",
                  )}
                </span>
              </Notice>
            </section>

            <section>
              <SectionHeading eyebrow={t("قبل الطلب", "Before ordering")} title={t("الدفع والتفعيل", "Payment and activation")} />
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {paymentFaq.map((item) => (
                  <div key={item.id} className="surface rounded-card p-5">
                    <h3 className="text-sm font-bold text-ink">{item.q[lang]}</h3>
                    <p className="mt-2 text-sm leading-7 text-ink-2">{item.a[lang]}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </Container>
    </>
  );
}
