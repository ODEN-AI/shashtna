import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, Check } from "lucide-react";

import s from "@/app/components/home/home.module.css";
import p from "@/app/components/plans/plan.module.css";
import { PlanBuy } from "@/app/components/plans/PlanBuy";
import { LinkButton } from "@/app/ui/Button";
import { distinctHighlights, repeatsDuration } from "@/app/ui/catalogue-text";
import { monthlyEquivalent } from "@/app/ui/PackageCard";
import { ErrorState } from "@/app/ui/States";
import { FAQ } from "@/src/content/help";
import { optionIdParam } from "@/src/lib/package-options";
import { formatPrice } from "@/src/lib/i18n";
import { formatDuration } from "@/src/lib/subscription-duration";
import {
  getActiveApps,
  getActiveDevices,
  getActivePackages,
  platformName,
  platformsOf,
  type CatalogApp,
  type CatalogDevice,
  type CatalogPackage,
} from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";
import { orderPointValue } from "@/src/lib/loyalty";
import { getLoyaltyRules } from "@/src/server/loyalty";

export const dynamic = "force-dynamic";

// Pictures when the plan has none of its own.
const VIP_ART = "/brand/vip-art.jpg";
const MARK = "/brand/shashtna-mark-256.webp";

type Params = { slug: string };
type Search = { renew?: string; upgrade?: string; option?: string };

/** The cheapest length a plan is sold in (for "from" prices). */
const lowestPrice = (pkg: CatalogPackage) => Math.min(...pkg.options.map((option) => option.price));

function positiveId(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const plan = await getActivePackages()
    .then((packages) => packages.find((pkg) => pkg.slug === slug))
    .catch(() => undefined);

  if (!plan) return { title: "الباقات" };

  return {
    title: plan.name,
    description: `${plan.name} من شاشتنا: ${plan.options.map((option) => option.durationLabel).join("، ")} بأسعار واضحة بالدينار العراقي. اختار المدة واطلب الباقة.`,
    alternates: { canonical: `/plans/${plan.slug}` },
  };
}

/**
 * One plan's details, between the plans page and checkout: the lengths it
 * is sold in with their prices (the customer picks one; ?option keeps the
 * choice), what it includes, what to know before buying (for VIP, the
 * compatible devices), how ordering works, the same service's other plans
 * and the payment questions. "Subscribe now" opens checkout with this plan
 * and length; a renewal or upgrade (?renew / ?upgrade) carries through every
 * link. Every name, price and fact comes from the catalogue.
 */
export default async function PlanPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const [{ slug }, search, { t, lang }] = await Promise.all([params, searchParams, getI18n()]);
  const renewId = positiveId(search.renew);
  const upgradeId = positiveId(search.upgrade);
  const carry = renewId ? `renew=${renewId}` : upgradeId ? `upgrade=${upgradeId}` : "";

  let data: { packages: CatalogPackage[]; devices: CatalogDevice[]; apps: CatalogApp[] } | null = null;

  try {
    const [packages, devices, apps] = await Promise.all([getActivePackages(), getActiveDevices(), getActiveApps().catch(() => [])]);
    data = { packages, devices, apps };
  } catch (error) {
    console.error("PLAN_PAGE_ERROR:", error);
  }

  if (data === null) {
    return (
      <div className={`${s.home} -mt-[80px] pt-[80px] pb-16`}>
        <div className={`${s.wrap} ${s.section}`}>
          <ErrorState
            title={t("تعذر تحميل الباقة", "The plan couldn't be loaded")}
            description={t("صار خطأ مؤقت. حدّث الصفحة بعد شوية.", "A temporary error occurred. Refresh the page shortly.")}
            action={<LinkButton href={`/plans/${encodeURIComponent(slug)}`} variant="secondary">{t("إعادة المحاولة", "Try again")}</LinkButton>}
          />
        </div>
      </div>
    );
  }

  const plan = data.packages.find((pkg) => pkg.slug === slug);
  if (!plan) notFound();

  const isVip = plan.serviceType === "VIP";
  // The length shown first: the one in the address when this plan sells it, else the default.
  const requested = optionIdParam(search.option);
  const initialOption = plan.options.find((option) => option.id === requested) ?? plan.options[0];
  const plansHref = `/plans${carry ? `?${carry}` : ""}#${isVip ? "vip" : "iptv"}`;
  const detailsHref = (pkg: CatalogPackage) => `/plans/${encodeURIComponent(pkg.slug)}${carry ? `?${carry}` : ""}`;

  const description = repeatsDuration(plan.description, plan) ? null : plan.description;
  const features = distinctHighlights(plan, 12);
  const devices = isVip ? data.devices.filter((device) => device.packageIds.includes(plan.id)) : [];
  const deviceFrom = devices.length ? Math.min(...devices.map((device) => device.price)) : null;
  const others = data.packages.filter((pkg) => pkg.serviceType === plan.serviceType && pkg.id !== plan.id);
  const platforms = platformsOf(data.apps).filter((item) => item.platform !== "—");
  // «هذا الطلب يعطيك X نقطة»: IPTV only, while the program is on. A renewal earns on its renewal price.
  const loyalty = isVip ? null : await getLoyaltyRules();
  const points = loyalty?.enabled
    ? Object.fromEntries(plan.options.map((option) => [option.id, orderPointValue(renewId ? (option.renewalPrice ?? option.price) : option.price, option.pointsEarned)]))
    : null;
  const paymentFaq = FAQ.filter((item) => item.topic === "payment" || item.id === "activation");
  const art = plan.imageUrl ?? (isVip ? VIP_ART : null);

  return (
    // -mt-[80px]/pt-[80px]: the navy ground runs up behind the floating header.
    <div className={`${s.home} -mt-[80px] pt-[80px] pb-16`}>
      <div className={s.wrap}>
        <Link href={plansHref} className={p.back}>
          <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
          {t("الباقات", "Plans")}
        </Link>

        <section className={`${p.hero} ${isVip ? p.heroVip : p.heroIptv}`} aria-labelledby="plan-title" data-testid="plan-details" data-service={plan.serviceType}>
          <div className={p.art}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art ?? MARK} alt="" className={art ? undefined : p.mark} />
          </div>

          <div className="min-w-0">
            <span className={`${p.duration} nums`}>
              <CalendarClock size={16} aria-hidden />
              {plan.serviceType} ·{" "}
              {plan.options.length > 1
                ? t(`${plan.options.length} مدد`, `${plan.options.length} lengths`)
                : formatDuration(plan.durationMonths, lang)}
            </span>
            <h1 id="plan-title" className={p.name} dir="auto" data-testid="plan-name">
              {plan.name}
            </h1>
            {description ? (
              <p className={p.desc} dir="auto">
                {description}
              </p>
            ) : null}

            <PlanBuy
              lang={lang}
              slug={plan.slug}
              options={plan.options}
              initialId={initialOption.id}
              carry={carry}
              isVip={isVip}
              deviceFrom={deviceFrom}
              hasOthers={others.length > 0}
              points={points}
            />

            {renewId || upgradeId ? (
              <p className={p.mode} role="status">
                {upgradeId
                  ? t("راح تنطلب هاي الباقة كترقية لاشتراكك.", "This plan will be ordered as an upgrade to your subscription.")
                  : t("راح تنطلب هاي الباقة كتجديد لاشتراكك.", "This plan will be ordered as a renewal of your subscription.")}
              </p>
            ) : null}
          </div>
        </section>

        <div className={p.grid2}>
          <section className={`${p.panel} ${isVip ? p.panelVip : ""}`} aria-labelledby="includes-title">
            <h2 id="includes-title">{t("شنو تحصل", "What you get")}</h2>
            <p>
              {isVip
                ? t(
                    "باقة ويا جهاز VIP مخصص تختاره عند الطلب. سعر الطلب يشمل الباقة والجهاز، والتجديد بعدين بدون جهاز.",
                    "A plan with a dedicated VIP device you pick when ordering. The order covers the plan and the device; later renewals need no device.",
                  )
                : t(
                    "قنوات وأفلام ومسلسلات على التلفزيون أو الموبايل اللي عندك. بعد التفعيل تستلم اسم مستخدم وكلمة مرور بحسابك.",
                    "Channels, films and series on the TV or phone you already have. After activation you get a username and password in your account.",
                  )}
            </p>
            <ul className={p.ticks}>
              {features.map((feature) => (
                <li key={feature}>
                  <span className={p.tick}>
                    <Check size={14} aria-hidden />
                  </span>
                  <bdi>{feature}</bdi>
                </li>
              ))}
              <li>
                <span className={p.tick}>
                  <Check size={14} aria-hidden />
                </span>
                {plan.options.length > 1
                  ? t("المدة اللي تختارها تبدأ من يوم التفعيل", "The length you choose starts on activation")
                  : t(
                      `مدة الاشتراك ${formatDuration(plan.durationMonths, "ar")}، تبدأ من يوم التفعيل`,
                      `${formatDuration(plan.durationMonths, "en")} of service, starting on activation`,
                    )}
              </li>
              <li>
                <span className={p.tick}>
                  <Check size={14} aria-hidden />
                </span>
                {t("حساب تتابع منه الاشتراك والتجديد والدعم", "An account to follow your plan, renewals and support")}
              </li>
            </ul>
          </section>

          {isVip ? (
            <section className={`${p.panel} ${p.panelVip}`} aria-labelledby="devices-title">
              <h2 id="devices-title">{t("الأجهزة المتوافقة", "Compatible devices")}</h2>
              <p>
                {t(
                  "تختار جهازك بصفحة الطلب، واخترنالك الأرخص بالبداية. السعر النهائي يشمل الباقة والجهاز.",
                  "You pick your device on the order page; the cheapest is selected to start. The total covers the plan and the device.",
                )}
              </p>
              {devices.length ? (
                <ul className={p.devices}>
                  {devices.map((device) => (
                    <li key={device.id} className={p.device}>
                      <span className={p.deviceArt}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={device.imageUrl ?? VIP_ART} alt="" loading="lazy" />
                      </span>
                      <span className="min-w-0">
                        <b dir="auto">{device.name}</b>
                        {device.description ? (
                          <small dir="auto" className="line-clamp-1">
                            {device.description}
                          </small>
                        ) : null}
                      </span>
                      <span className={`${p.devicePrice} nums`}>+ {formatPrice(device.price, lang)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[15px] leading-7 text-[#f1cf7a]">
                  {t(
                    "ماكو جهاز VIP متوافق مع هاي الباقة حاليًا. تواصل ويانا أو اختار باقة ثانية.",
                    "No compatible VIP device is available for this plan right now. Contact us or choose another plan.",
                  )}
                </p>
              )}
              <Link href="/devices" className={p.more}>
                {t("كل أجهزة VIP", "All VIP devices")}
                <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
              </Link>
            </section>
          ) : (
            <section className={p.panel} aria-labelledby="watch-title">
              <h2 id="watch-title">{t("وين تشاهد", "Where you watch")}</h2>
              <p>
                {t(
                  "حمّل Shashtna Player أو التطبيق المناسب لجهازك. بيانات الدخول تلگاها بحسابك بعد التفعيل.",
                  "Download Shashtna Player or the right app for your device. Your login details are in your account after activation.",
                )}
              </p>
              {platforms.length ? (
                <ul className={p.chips}>
                  {platforms.map((item) => (
                    <li key={item.platform}>
                      <Link href={`/apps#${encodeURIComponent(item.platform)}`}>{platformName(item.platform)}</Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link href="/apps" className={p.more}>
                {t("التطبيقات وخطوات الإعداد", "Apps and setup steps")}
                <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
              </Link>
            </section>
          )}
        </div>

        {plan.notes ? (
          <section className={`${p.panel} ${isVip ? p.panelVip : ""}`} style={{ marginTop: 20 }} aria-labelledby="notes-title">
            <h2 id="notes-title">{t("قبل ما تشترك", "Before you subscribe")}</h2>
            <p className="whitespace-pre-line" dir="auto">
              {plan.notes}
            </p>
          </section>
        ) : null}

        <section className={s.section} aria-labelledby="how-title">
          <p className={s.kicker}>{t("خطوات بسيطة", "Simple steps")}</p>
          <h2 id="how-title" className={s.h2}>
            {t("شلون تشترك", "How to subscribe")}
          </h2>
          <ol className={p.steps}>
            <li className={p.step}>
              <h3>{t("أكّد الطلب", "Confirm the order")}</h3>
              <p>
                {isVip
                  ? t("اضغط «اشترك الآن»، اختار جهازك وأكّد الطلب من حسابك.", "Tap “Subscribe now”, pick your device and confirm from your account.")
                  : t("اضغط «اشترك الآن» وأكّد الطلب من حسابك.", "Tap “Subscribe now” and confirm the order from your account.")}
              </p>
            </li>
            <li className={p.step}>
              <h3>{t("حوّل المبلغ", "Send the payment")}</h3>
              <p>
                {t(
                  "حسابك يعرضلك المبلغ ورقم التحويل. حوّل وارفع صورة الإثبات.",
                  "Your account shows the amount and the transfer number. Transfer it and upload the screenshot.",
                )}
              </p>
            </li>
            <li className={p.step}>
              <h3>{t("نفعّل اشتراكك", "We activate it")}</h3>
              <p>
                {t(
                  "فريقنا يراجع الدفع ويفعّل الاشتراك، وتلگى التفاصيل والإيصال بحسابك.",
                  "Our team checks the payment and activates your plan; details and receipt are in your account.",
                )}
              </p>
            </li>
          </ol>
        </section>

        {others.length ? (
          <section id="other-plans" className="scroll-mt-24" aria-labelledby="others-title">
            <p className={s.kicker} style={isVip ? { color: "var(--gold)" } : undefined}>
              {plan.serviceType}
            </p>
            <h2 id="others-title" className={s.h2}>
              {t("باقات ثانية", "Other plans")}
            </h2>
            <ul className={p.others}>
              {others.map((pkg) => {
                const monthly = monthlyEquivalent(pkg.price, pkg.durationMonths);

                return (
                  <li key={pkg.id}>
                    <Link href={detailsHref(pkg)} className={`${p.other} ${isVip ? p.otherVip : ""}`} data-testid="plan-other">
                      <small className="nums">
                        {pkg.options.length > 1
                          ? pkg.options.map((option) => formatDuration(option.durationMonths, lang)).join(" · ")
                          : formatDuration(pkg.durationMonths, lang)}
                      </small>
                      <b dir="auto">{pkg.name}</b>
                      <span className={`${p.otherPrice} nums`}>
                        {pkg.options.length > 1 ? t(`من ${formatPrice(lowestPrice(pkg), lang)}`, `From ${formatPrice(lowestPrice(pkg), lang)}`) : formatPrice(pkg.price, lang)}
                      </span>
                      {monthly ? (
                        <span className={`${p.otherPer} nums`}>
                          {t(`≈ ${formatPrice(monthly, lang)} بالشهر`, `≈ ${formatPrice(monthly, lang)} a month`)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {paymentFaq.length ? (
          <section className={s.section} aria-labelledby="plan-faq-title">
            <p className={s.kicker}>{t("قبل ما تطلب", "Before you order")}</p>
            <h2 id="plan-faq-title" className={s.h2}>
              {t("الدفع والتفعيل", "Payment and activation")}
            </h2>
            <div className={p.faq}>
              {paymentFaq.map((item) => (
                <details key={item.id} className={s.question}>
                  <summary>
                    {item.q[lang]}
                    <span className={s.plus} aria-hidden>
                      +
                    </span>
                  </summary>
                  <p>{item.a[lang]}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
