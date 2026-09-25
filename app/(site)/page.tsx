import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck2,
  Code2,
  Globe,
  LayoutDashboard,
  Check,
  CircleHelp,
  Clock3,
  Crown,
  Headphones,
  MonitorPlay,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tv,
  UserPlus,
  Wallet,
} from "lucide-react";

import { AccountStrip } from "@/app/components/site/AccountStrip";
import { AnnouncementCarousel } from "@/app/ui/AnnouncementCarousel";
import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { LogoMark } from "@/app/ui/Logo";
import { PackageCard } from "@/app/ui/PackageCard";
import { Container, Eyebrow, SectionHeading } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { FacebookIcon, TelegramIcon, WhatsAppIcon } from "@/app/ui/BrandIcons";
import { DIGITAL_SERVICE_AREAS } from "@/src/content/digital-services";
import { FAQ } from "@/src/content/help";
import { formatPrice, type Lang } from "@/src/lib/i18n";
import { getSessionUser } from "@/src/server/auth";
import {
  getActiveApps,
  getActivePackages,
  platformsOf,
  rankPopular,
  type CatalogPackage,
} from "@/src/server/catalog";
import { getLiveAnnouncements } from "@/src/server/content";
import { getI18n } from "@/src/server/i18n";
import { getSettings, safeExternalUrl, whatsappLink } from "@/src/server/settings";


const SERVICE_ICONS = {
  apps: <Smartphone size={19} aria-hidden />,
  web: <Globe size={19} aria-hidden />,
  platforms: <LayoutDashboard size={19} aria-hidden />,
  custom: <Code2 size={19} aria-hidden />,
} as const;

export const dynamic = "force-dynamic";

function planHref(pkg: CatalogPackage) {
  return `/checkout?plan=${encodeURIComponent(pkg.slug)}`;
}

function minPrice(packages: CatalogPackage[]) {
  return packages.length ? Math.min(...packages.map((pkg) => pkg.price)) : null;
}

function durations(packages: CatalogPackage[]) {
  return [...new Set(packages.map((pkg) => pkg.durationLabel))];
}

export default async function HomePage() {
  const [{ t, lang, isAr }, user, packages, apps, slides, settings] = await Promise.all([
    getI18n(),
    getSessionUser().catch(() => null),
    getActivePackages().catch(() => [] as CatalogPackage[]),
    getActiveApps().catch(() => []),
    getLiveAnnouncements("WEBSITE", "HOME_CAROUSEL").catch(() => []),
    getSettings(),
  ]);

  const iptv = packages.filter((pkg) => pkg.serviceType === "IPTV");
  const vip = packages.filter((pkg) => pkg.serviceType === "VIP");
  const popular = rankPopular(packages, 3);
  const cheapest = minPrice(packages);
  const platforms = platformsOf(apps);
  const player = apps.find((app) => app.isPlayer);
  const hours = isAr ? settings["support.hours"] : settings["support.hoursEn"];

  return (
    <>
      {user ? <AccountStrip user={user} /> : null}

      {/* ============================ HERO ============================ */}
      <section className="bg-cinema relative overflow-hidden">
        <Container className="grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div className="animate-fade-up">
            <Eyebrow>IPTV · VIP · Shashtna Player</Eyebrow>
            <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.15] text-ink sm:text-5xl lg:text-[3.4rem]">
              {t("قنواتك وأفلامك ومسلسلاتك،", "Your channels, films and series,")}{" "}
              <span className="text-gradient">{t("باشتراك واحد واضح", "in one clear subscription")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-8 text-ink-2 sm:text-lg">
              {t(
                "اختار باقتك، أكمل طلبك بخطوات بسيطة، وتابع اشتراكك وتجديده من حسابك — وشغّل كلشي على Shashtna Player.",
                "Pick a plan, complete your order in a few simple steps, and manage your subscription and renewals from your account — then watch on Shashtna Player.",
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="#plans" size="lg">
                {t("شوف الباقات", "See plans")}
                <ArrowLeft size={18} className="ltr:rotate-180" aria-hidden />
              </LinkButton>
              <LinkButton href="/watch/player" variant="secondary" size="lg">
                <MonitorPlay size={18} aria-hidden />
                Shashtna Player
              </LinkButton>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-2">
              {cheapest !== null ? (
                <li className="flex items-center gap-2">
                  <Wallet size={16} className="text-glow" aria-hidden />
                  {t("تبدأ من ", "From ")}
                  <span className="nums font-bold text-ink">{formatPrice(cheapest, lang)}</span>
                </li>
              ) : null}
              <li className="flex items-center gap-2">
                <PackageCheck size={16} className="text-glow" aria-hidden />
                {t("تتبّع طلبك خطوة بخطوة", "Track your order step by step")}
              </li>
              {hours ? (
                <li className="flex items-center gap-2">
                  <Clock3 size={16} className="text-glow" aria-hidden />
                  {t("دعم ", "Support ")}
                  {hours}
                </li>
              ) : null}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-xl animate-fade-up [animation-delay:120ms]">
            <div
              aria-hidden
              className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgba(47,107,255,0.28),transparent)]"
            />
            <div className="relative rounded-[1.9rem] border border-white/10 bg-gradient-to-b from-[#1a2440] to-[#0b1222] p-2.5 shadow-[0_40px_120px_-40px_rgba(47,107,255,0.6)]">
              <div className="overflow-hidden rounded-[1.4rem] bg-black">
                <video
                  className="block aspect-[16/10] w-full object-cover"
                  src="/videos/shashtna-ad-web.mp4"
                  poster="/videos/shashtna-ad-poster.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={t("إعلان شاشتنا", "Shashtna promo video")}
                />
              </div>
            </div>
            <div aria-hidden className="mx-auto h-3 w-40 rounded-b-2xl bg-gradient-to-b from-[#1a2440] to-transparent" />
          </div>
        </Container>
      </section>

      {/* ======================= ADS / ANNOUNCEMENTS ======================= */}
      {slides.length ? (
        <Container className="py-6">
          <AnnouncementCarousel
            slides={slides.map((slide) => ({
              id: slide.id,
              title: slide.title,
              description: slide.description,
              imageUrl: slide.imageUrl,
              ctaLabel: slide.ctaLabel,
              ctaUrl: slide.ctaUrl,
              style: slide.style,
            }))}
            label={t("إعلانات شاشتنا", "Shashtna announcements")}
            previousLabel={t("السابق", "Previous")}
            nextLabel={t("التالي", "Next")}
          />
        </Container>
      ) : null}

      {/* ========================= POPULAR PLANS ========================= */}
      <section id="plans" className="scroll-mt-20 py-16 sm:py-20">
        <Container>
          <SectionHeading
            eyebrow={t("الباقات", "Plans")}
            title={t("اختار الباقة اللي تناسبك", "Choose the plan that suits you")}
            description={t(
              "أسعار واضحة قبل الطلب. الباقات الأكثر طلبًا حسب الاشتراكات الفعلية عندنا.",
              "Clear prices before you order. Ranked by real subscriptions.",
            )}
            action={
              <LinkButton href="/plans" variant="ghost">
                {t("كل الباقات", "All plans")}
                <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
              </LinkButton>
            }
          />
          {popular.length ? (
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {popular.map((pkg, index) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  lang={lang}
                  href={planHref(pkg)}
                  featured={index === 0 && !popular.some((item) => item.isPopular)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-10"
              title={t("ماكو باقات منشورة حاليًا", "No plans are published right now")}
              description={t(
                "راح تظهر الباقات هنا أول ما تنشر. تكدر تتواصل ويانا بأي وقت.",
                "Plans will appear here as soon as they're published. You can contact us any time.",
              )}
              action={
                <LinkButton href="/help/contact" variant="secondary">
                  {t("تواصل ويانا", "Contact us")}
                </LinkButton>
              }
            />
          )}
        </Container>
      </section>

      {/* ========================= COMPARE ========================= */}
      {iptv.length || vip.length ? (
        <section className="border-y border-line bg-surface/40 py-16 sm:py-20">
          <Container>
            <SectionHeading
              align="center"
              eyebrow={t("المقارنة", "Compare")}
              title={t("IPTV أو VIP؟", "IPTV or VIP?")}
              description={t(
                "نوعين من الاشتراك. الفرق الأساسي هو الجهاز وطريقة الدخول.",
                "Two kinds of subscription. The main difference is the device and how you sign in.",
              )}
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {[
                {
                  key: "IPTV",
                  list: iptv,
                  icon: <Tv size={20} aria-hidden />,
                  title: t("باقات IPTV", "IPTV plans"),
                  body: t(
                    "قنوات رياضية وترفيهية وأفلام ومسلسلات عبر الإنترنت، على جهازك وتطبيقك.",
                    "Sports and entertainment channels, films and series online, on your own device and app.",
                  ),
                  rows: [
                    { label: t("الجهاز", "Device"), value: t("جهازك الخاص مع تطبيق مدعوم", "Your own device with a supported app") },
                    { label: t("الدخول", "Sign-in"), value: t("اسم مستخدم وكلمة مرور", "Username and password") },
                  ],
                },
                {
                  key: "VIP",
                  list: vip,
                  icon: <Crown size={20} aria-hidden />,
                  title: t("باقات VIP", "VIP plans"),
                  body: t(
                    "تجربة مشاهدة مميزة مع جهاز VIP مخصص مرتبط باشتراكك.",
                    "A premium experience with a dedicated VIP device linked to your subscription.",
                  ),
                  rows: [
                    { label: t("الجهاز", "Device"), value: t("جهاز VIP ضمن الطلب", "VIP device included in the order") },
                    { label: t("الدخول", "Sign-in"), value: t("مرتبط برقم الجهاز", "Linked to the device ID") },
                  ],
                },
              ].map((column) =>
                column.list.length ? (
                  <article key={column.key} className="surface flex flex-col rounded-panel p-6 sm:p-8">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface-3 text-glow">
                        {column.icon}
                      </span>
                      <h3 className="text-xl font-bold text-ink">{column.title}</h3>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-ink-2">{column.body}</p>
                    <dl className="mt-6 divide-y divide-line border-y border-line">
                      {[
                        ...column.rows,
                        { label: t("المدد المتاحة", "Durations"), value: durations(column.list).join(" · ") },
                        {
                          label: t("يبدأ من", "Starts at"),
                          value: formatPrice(minPrice(column.list) ?? 0, lang),
                        },
                      ].map((row) => (
                        <div key={row.label} className="flex items-start justify-between gap-4 py-3.5 text-sm">
                          <dt className="text-ink-3">{row.label}</dt>
                          <dd className="nums text-end font-semibold text-ink">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-6">
                      <LinkButton href={`/plans#${column.key.toLowerCase()}`} variant="secondary" className="w-full">
                        {t("شوف باقات ", "See ")}
                        {column.key}
                        {isAr ? "" : " plans"}
                      </LinkButton>
                    </div>
                  </article>
                ) : null,
              )}
            </div>
          </Container>
        </section>
      ) : null}

      {/* ========================= SHASHTNA PLAYER ========================= */}
      <section className="py-16 sm:py-24">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Shashtna Player</Eyebrow>
            <h2 className="mt-3 text-balance text-3xl font-bold leading-tight text-ink sm:text-4xl">
              {t("المشغل الرسمي لشاشتنا", "The official Shashtna player")}
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-8 text-ink-2">
              {t(
                "تطبيق Shashtna Player مصمم لأندرويد وأندرويد TV. حمّله، سجّل دخولك، وابدأ المشاهدة.",
                "Shashtna Player is built for Android and Android TV. Install it, sign in and start watching.",
              )}
            </p>
            <ul className="mt-6 space-y-3 text-sm text-ink-2">
              {[
                t("بيانات اشتراكك موجودة بحسابك وجاهزة للنسخ", "Your subscription details are in your account, ready to copy"),
                t("روابط تحميل وخطوات إعداد واضحة", "Clear download links and setup steps"),
                t("دعم فني مرتبط باشتراكك عند الحاجة", "Support linked to your subscription when you need it"),
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check size={17} className="mt-0.5 shrink-0 text-glow" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/watch/player" size="lg">
                <MonitorPlay size={18} aria-hidden />
                {player ? t("تحميل Shashtna Player", "Get Shashtna Player") : t("عن Shashtna Player", "About Shashtna Player")}
              </LinkButton>
            </div>
            <p className="mt-5 inline-flex items-center gap-2 text-xs text-ink-3">
              <Badge tone="neutral">{t("قريبًا", "Coming soon")}</Badge>
              {t("ربط التلفزيون بحسابك برمز QR بدل إدخال البيانات يدويًا.", "Link your TV to your account with a QR code instead of typing details.")}
            </p>
          </div>

          <PlayerIllustration lang={lang} />
        </Container>
      </section>

      {/* ========================= WATCH ON ========================= */}
      <section className="border-y border-line bg-surface/40 py-16 sm:py-20">
        <Container>
          <SectionHeading
            eyebrow={t("شاهد على", "Watch on")}
            title={t("شغّل اشتراكك على جهازك", "Watch on your device")}
            description={t(
              "المنصات اللي عندنا لها تطبيق جاهز، مع رابط التحميل وخطوات الإعداد.",
              "Platforms with a ready app, including download links and setup steps.",
            )}
            action={
              <LinkButton href="/watch" variant="ghost">
                {t("كل الأجهزة", "All devices")}
                <ArrowLeft size={16} className="ltr:rotate-180" aria-hidden />
              </LinkButton>
            }
          />
          {platforms.length ? (
            <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {platforms.map(({ platform, apps: platformApps }) => (
                <li key={platform}>
                  <Link
                    href={`/watch#${encodeURIComponent(platform)}`}
                    className="surface group flex h-full flex-col rounded-card p-5 transition hover:-translate-y-0.5 hover:border-brand/50"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface-3 text-brand-ink transition group-hover:text-glow">
                      {/tv|تلفز/i.test(platform) ? <Tv size={20} aria-hidden /> : <Smartphone size={20} aria-hidden />}
                    </span>
                    <span className="mt-4 text-base font-bold text-ink">{platform}</span>
                    <span className="mt-1 text-xs text-ink-3">
                      {isAr
                        ? `${platformApps.length} ${platformApps.length === 1 ? "تطبيق" : "تطبيقات"}`
                        : `${platformApps.length} app${platformApps.length === 1 ? "" : "s"}`}
                    </span>
                  </Link>
                </li>
              ))}
              {vip.length ? (
                <li>
                  <Link
                    href="/devices"
                    className="surface group flex h-full flex-col rounded-card p-5 transition hover:-translate-y-0.5 hover:border-glow/50"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface-3 text-glow">
                      <Crown size={20} aria-hidden />
                    </span>
                    <span className="mt-4 text-base font-bold text-ink">{t("أجهزة VIP", "VIP devices")}</span>
                    <span className="mt-1 text-xs text-ink-3">{t("جاهزة لباقات VIP", "Ready for VIP plans")}</span>
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : (
            <EmptyState
              className="mt-10"
              compact
              title={t("قائمة التطبيقات قيد التحديث", "The apps list is being updated")}
              description={t("تواصل ويانا ونساعدك تختار التطبيق المناسب لجهازك.", "Contact us and we'll help you choose the right app for your device.")}
            />
          )}
        </Container>
      </section>

      {/* ========================= TRUST ========================= */}
      <section className="py-16 sm:py-24">
        <Container>
          <SectionHeading
            align="center"
            eyebrow={t("ليش شاشتنا", "Why Shashtna")}
            title={t("خدمة واضحة من أول خطوة", "A clear service from the first step")}
          />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Wallet size={20} aria-hidden />,
                title: t("أسعار معلنة", "Published prices"),
                body: t("سعر كل باقة ومدتها واضحين قبل ما ترسل الطلب.", "Every plan's price and duration are shown before you order."),
              },
              {
                icon: <PackageCheck size={20} aria-hidden />,
                title: t("طلب تتابعه", "Orders you can follow"),
                body: t("كل طلب إله رقم وحالة تتحدث لحد التفعيل.", "Every order has a number and a status that updates until activation."),
              },
              {
                icon: <ReceiptText size={20} aria-hidden />,
                title: t("حسابك بإيدك", "Your account, in your hands"),
                body: t("اشتراكاتك وتواريخ الانتهاء والإيصالات والتجديد بمكان واحد.", "Subscriptions, expiry dates, receipts and renewals in one place."),
              },
              {
                icon: <Headphones size={20} aria-hidden />,
                title: t("دعم مرتبط باشتراكك", "Support tied to your plan"),
                body: t("افتح تذكرة من حسابك وتوصلك إشعارات الرد.", "Open a ticket from your account and get notified of replies."),
              },
            ].map((item) => (
              <li key={item.title} className="surface rounded-card p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand-ink">
                  {item.icon}
                </span>
                <h3 className="mt-5 text-base font-bold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-ink-2">{item.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ========================= HOW IT WORKS ========================= */}
      <section className="border-y border-line bg-surface/40 py-16 sm:py-20">
        <Container>
          <SectionHeading
            eyebrow={t("شلون تشتغل", "How it works")}
            title={t("من الاختيار للمشاهدة بأربع خطوات", "From choosing to watching in four steps")}
          />
          <ol className="mt-10 grid gap-5 md:grid-cols-4">
            {[
              { icon: <Sparkles size={19} aria-hidden />, title: t("اختار باقة", "Choose a plan"), body: t("قارن الباقات واختار المدة المناسبة.", "Compare plans and pick a duration.") },
              { icon: <UserPlus size={19} aria-hidden />, title: t("أرسل طلبك", "Place your order"), body: t("سجّل دخولك وأكمل الطلب — ياخذ دقيقة.", "Sign in and complete the order — it takes a minute.") },
              { icon: <Wallet size={19} aria-hidden />, title: t("رتّب الدفع", "Arrange payment"), body: t("فريقنا يتواصل وياك لإتمام الدفع.", "Our team contacts you to complete payment.") },
              { icon: <CalendarCheck2 size={19} aria-hidden />, title: t("شاهد", "Watch"), body: t("بعد التفعيل تلگى بياناتك بحسابك وتبدأ.", "After activation your details are in your account.") },
            ].map((step, index) => (
              <li key={step.title} className="surface relative rounded-card p-6">
                <span className="nums absolute end-5 top-5 text-4xl font-bold text-line-strong">{index + 1}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-3 text-glow">
                  {step.icon}
                </span>
                <h3 className="mt-5 text-base font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ===================== ABOUT + DIGITAL SERVICES ===================== */}
      <section className="py-16 sm:py-24">
        <Container className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
          <div className="surface flex flex-col rounded-panel p-6 sm:p-8">
            <Eyebrow>{t("من نحن", "About us")}</Eyebrow>
            <h2 className="mt-3 text-balance text-2xl font-bold leading-tight text-ink sm:text-[28px]">
              {t("شاشتنا مو بس اشتراك.", "Shashtna is more than a subscription.")}
            </h2>
            <p className="mt-4 text-[15px] leading-8 text-ink-2">
              {t(
                "شاشتنا علامة عراقية تجمع بين الترفيه والتقنية: اشتراكات مشاهدة واضحة مع تطبيق Shashtna Player ودعم تعرف وين تلگاه، وفريق يبني تطبيقات ومواقع ومنصات رقمية.",
                "Shashtna is an Iraqi brand that brings entertainment and technology together: clear viewing subscriptions with the Shashtna Player app and support you can find, and a team that builds apps, websites and digital platforms.",
              )}
            </p>
            <ul className="mt-5 grid gap-2.5 border-t border-line pt-5 text-sm text-ink-2">
              <li className="flex items-center gap-2.5">
                <Tv size={16} className="shrink-0 text-glow" aria-hidden />
                {t("الترفيه: اشتراكات، Shashtna Player، ودعم", "Entertainment: plans, Shashtna Player and support")}
              </li>
              <li className="flex items-center gap-2.5">
                <Code2 size={16} className="shrink-0 text-glow" aria-hidden />
                {t("التقنية: تطبيقات، مواقع، ومنصات رقمية", "Technology: apps, websites and digital platforms")}
              </li>
            </ul>
            <div className="mt-auto pt-6">
              <LinkButton href="/about" variant="secondary">
                {t("تعرّف علينا", "Get to know us")}
                <ArrowLeft size={16} aria-hidden className="ltr:rotate-180" />
              </LinkButton>
            </div>
          </div>

          <div className="surface-raised relative overflow-hidden rounded-panel p-6 sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-glow/70 to-transparent"
            />
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow>{t("خدماتنا", "Our services")}</Eyebrow>
                <h2 className="mt-3 text-balance text-2xl font-bold leading-tight text-ink sm:text-[28px]">
                  {t("نبني منتجات رقمية أيضًا", "We build digital products too")}
                </h2>
              </div>
              <LinkButton href="/services" variant="ghost" size="sm">
                {t("كل الخدمات", "All services")}
                <ArrowLeft size={15} aria-hidden className="ltr:rotate-180" />
              </LinkButton>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {DIGITAL_SERVICE_AREAS.map((area) => (
                <li key={area.id} className="flex gap-3 rounded-2xl border border-line bg-surface/60 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-3 text-glow">
                    {SERVICE_ICONS[area.id]}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-bold text-ink">{area.title[lang]}</h3>
                    <p className="mt-1 text-sm leading-6 text-ink-3">{area.body[lang]}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href="/services/request">{t("اطلب عرض سعر", "Request a quote")}</LinkButton>
            </div>
          </div>
        </Container>
      </section>

      {/* ========================= FAQ + SUPPORT ========================= */}
      <section className="py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <SectionHeading eyebrow={t("أسئلة شائعة", "FAQ")} title={t("قبل ما تشترك", "Before you subscribe")} />
            <div className="mt-8 space-y-3">
              {FAQ.slice(0, 5).map((item) => (
                <details key={item.id} className="surface group rounded-2xl px-5 py-1 open:pb-4">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                    {item.q[lang]}
                    <span aria-hidden className="text-xl leading-none text-ink-3 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="text-sm leading-7 text-ink-2">{item.a[lang]}</p>
                </details>
              ))}
            </div>
            <LinkButton href="/help#faq" variant="ghost" className="mt-5">
              <CircleHelp size={16} aria-hidden />
              {t("كل الأسئلة", "All questions")}
            </LinkButton>
          </div>

          <SupportCard lang={lang} settings={settings} hours={hours} />
        </Container>
      </section>

      {/* ========================= FINAL CTA ========================= */}
      <section className="pb-20">
        <Container>
          <div className="relative overflow-hidden rounded-panel border border-brand/30 bg-gradient-to-br from-[#123594] via-[#0b1d52] to-[#070d1c] px-6 py-12 text-center sm:px-12 sm:py-16">
            <div aria-hidden className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-glow/70 to-transparent" />
            <ShieldCheck size={30} className="mx-auto text-glow" aria-hidden />
            <h2 className="mx-auto mt-5 max-w-2xl text-balance text-3xl font-bold text-white sm:text-4xl">
              {t("جاهز تبدأ المشاهدة؟", "Ready to start watching?")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-8 text-white/75">
              {t("اختار باقتك، وخلي الباقي علينا.", "Pick your plan and leave the rest to us.")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <LinkButton href="/plans" variant="glow" size="lg">
                {t("استعرض الباقات", "Browse plans")}
              </LinkButton>
              {!user ? (
                <LinkButton href="/register" variant="secondary" size="lg">
                  {t("إنشاء حساب", "Create account")}
                </LinkButton>
              ) : null}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function SupportCard({
  lang,
  settings,
  hours,
}: {
  lang: Lang;
  settings: Awaited<ReturnType<typeof getSettings>>;
  hours: string;
}) {
  const isAr = lang === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const channels = [
    safeExternalUrl(settings["contact.telegram"]) && {
      href: safeExternalUrl(settings["contact.telegram"])!,
      label: "Telegram",
      icon: <TelegramIcon size={18} />,
    },
    whatsappLink(settings["contact.whatsapp"]) && {
      href: whatsappLink(settings["contact.whatsapp"])!,
      label: "WhatsApp",
      icon: <WhatsAppIcon size={18} />,
    },
    safeExternalUrl(settings["contact.facebook"]) && {
      href: safeExternalUrl(settings["contact.facebook"])!,
      label: "Facebook",
      icon: <FacebookIcon size={18} />,
    },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  return (
    <aside className="surface-raised h-fit rounded-panel p-6 sm:p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand-ink">
        <Headphones size={22} aria-hidden />
      </span>
      <h2 className="mt-5 text-xl font-bold text-ink">{t("نحتاج نساعدك؟", "Need a hand?")}</h2>
      <p className="mt-2 text-sm leading-7 text-ink-2">
        {t("مركز المساعدة بيه حلول لأكثر المشاكل شيوعًا، وفريقنا موجود إذا احتجت.", "The help centre covers the most common issues, and our team is here if you need them.")}
      </p>
      {hours ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line bg-surface-3 px-3 py-2 text-xs font-semibold text-ink-2">
          <Clock3 size={14} aria-hidden />
          {hours}
        </p>
      ) : null}
      <div className="mt-6 grid gap-2">
        <LinkButton href="/help" variant="primary">
          {t("مركز المساعدة", "Help centre")}
        </LinkButton>
        {channels.map((channel) => (
          <LinkButton key={channel.label} href={channel.href} external variant="secondary">
            {channel.icon}
            {channel.label}
          </LinkButton>
        ))}
      </div>
    </aside>
  );
}

/** Stylised Player UI. Decorative only — it doesn't show real content. */
function PlayerIllustration({ lang }: { lang: Lang }) {
  const isAr = lang === "ar";
  const categories = isAr
    ? ["مباشر", "رياضة", "أفلام", "مسلسلات", "أطفال"]
    : ["Live", "Sports", "Movies", "Series", "Kids"];
  const tiles = [
    "from-[#2f6bff] to-[#0b1d52]",
    "from-[#22d3ee]/80 to-[#0b2a3d]",
    "from-[#6d4bff] to-[#1b1340]",
    "from-[#1e40af] to-[#0a1024]",
    "from-[#0ea5e9] to-[#0b1d33]",
    "from-[#3b82f6] to-[#101a33]",
  ];

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-8 rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.14),transparent)]" />
      <div className="relative rounded-[1.9rem] border border-white/10 bg-gradient-to-b from-[#1a2440] to-[#0b1222] p-2.5">
        <div className="grid aspect-[16/10] grid-cols-[30%_1fr] overflow-hidden rounded-[1.4rem] bg-[#060b17]">
          <div className="border-e border-white/5 bg-[#08101f] p-3">
            <div className="flex items-center gap-2">
              <LogoMark className="h-6 w-6" />
              <span className="text-[11px] font-bold text-white/80">Player</span>
            </div>
            <ul className="mt-4 space-y-1.5">
              {categories.map((category, index) => (
                <li
                  key={category}
                  className={`rounded-md px-2 py-1.5 text-[10px] font-semibold ${index === 0 ? "bg-brand/25 text-white" : "text-white/45"}`}
                >
                  {category}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3">
            <div className="h-[42%] rounded-lg bg-gradient-to-br from-[#1b3d9e] via-[#0e1e4d] to-[#070d1c] p-3">
              <div className="h-1.5 w-16 rounded bg-white/70" />
              <div className="mt-1.5 h-1 w-24 rounded bg-white/30" />
              <div className="mt-3 h-4 w-12 rounded bg-white/85" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {tiles.map((tile) => (
                <div key={tile} className={`aspect-video rounded-md bg-gradient-to-br ${tile}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
