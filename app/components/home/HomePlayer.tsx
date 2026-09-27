import { Check, MonitorPlay } from "lucide-react";

import { Badge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { LogoMark } from "@/app/ui/Logo";
import { Container, Eyebrow } from "@/app/ui/Page";
import { translator, type Lang } from "@/src/lib/i18n";

/** Shashtna Player as a product: one visual, a short promise, three capabilities. */
export function HomePlayer({ lang, hasPlayerApp }: { lang: Lang; hasPlayerApp: boolean }) {
  const t = translator(lang);

  return (
    <section className="py-16 sm:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow>Shashtna Player</Eyebrow>
          <h2 className="mt-3 text-balance text-h2 font-bold text-ink">
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
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/20 text-glow">
                  <Check size={13} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/watch/player" size="lg">
              <MonitorPlay size={18} aria-hidden />
              {hasPlayerApp ? t("تحميل Shashtna Player", "Get Shashtna Player") : t("عن Shashtna Player", "About Shashtna Player")}
            </LinkButton>
          </div>
          <p className="mt-5 inline-flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <Badge tone="neutral">{t("قريبًا", "Coming soon")}</Badge>
            {t("ربط التلفزيون بحسابك برمز QR بدل إدخال البيانات يدويًا.", "Link your TV to your account with a QR code instead of typing details.")}
          </p>
        </div>

        <PlayerIllustration lang={lang} />
      </Container>
    </section>
  );
}

/** Stylised Player UI. Decorative only — it doesn't show real content. */
function PlayerIllustration({ lang }: { lang: Lang }) {
  const categories = lang === "ar" ? ["مباشر", "رياضة", "أفلام", "مسلسلات", "أطفال"] : ["Live", "Sports", "Movies", "Series", "Kids"];
  const tiles = [
    "from-brand to-navy",
    "from-sky/80 to-surface",
    "from-brand-strong to-canvas",
    "from-glow/40 to-navy",
    "from-sky to-brand-strong",
    "from-navy to-canvas",
  ];

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-8 rounded-full bg-[radial-gradient(closest-side,rgb(55_129_252/0.2),transparent)]" />
      <div className="glass-soft relative rounded-[2rem] p-2 shadow-float">
        <div className="grid aspect-[16/10] grid-cols-[30%_1fr] overflow-hidden rounded-[1.5rem] bg-canvas">
          <div className="border-e border-white/5 bg-canvas-deep p-3">
            <div className="flex items-center gap-2">
              <LogoMark className="h-6 w-6" />
              <span className="text-[11px] font-bold text-white/80">Player</span>
            </div>
            <ul className="mt-4 space-y-1.5">
              {categories.map((category, index) => (
                <li
                  key={category}
                  className={`rounded-md px-2 py-1.5 text-[10px] font-semibold ${index === 0 ? "bg-brand/30 text-white" : "text-white/45"}`}
                >
                  {category}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3">
            <div className="h-[42%] rounded-lg bg-gradient-to-br from-brand-strong via-navy to-canvas p-3">
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
