import { BadgeCheck, CreditCard, ReceiptText, Sparkles, Upload, Wallet } from "lucide-react";

import { Container, SectionHeading } from "@/app/ui/Page";
import { translator, type Lang } from "@/src/lib/i18n";
import { JOURNEY_STEPS, type JourneyStepKey } from "@/src/lib/order-journey";

/**
 * The real purchase journey — the same four steps (and labels) the customer
 * then sees on their order in the dashboard (src/lib/order-journey.ts).
 * Activation is done by the team after reviewing the transfer; nothing here
 * promises instant or automatic activation.
 */
export function HomeHowItWorks({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const isAr = lang === "ar";

  const details: Record<JourneyStepKey, { icon: React.ReactNode; body: string }> = {
    SELECT: {
      icon: <Sparkles size={19} aria-hidden />,
      body: t("قارن الباقات، اختار المدة، وأكّد طلبك من حسابك.", "Compare plans, pick a duration and confirm your order from your account."),
    },
    PAY: {
      icon: <CreditCard size={19} aria-hidden />,
      body: t("حوّل مبلغ الطلب إلى رقم التحويل الظاهر بحسابك.", "Transfer the order amount to the transfer number shown in your account."),
    },
    PROOF: {
      icon: <Upload size={19} aria-hidden />,
      body: t("ارفع صورة إثبات الدفع على نفس الطلب.", "Upload a screenshot of the payment on the same order."),
    },
    REVIEW: {
      icon: <BadgeCheck size={19} aria-hidden />,
      body: t("فريقنا يراجع الدفع ويفعّل اشتراكك، وتلگى بياناته بحسابك.", "Our team reviews the payment and activates your plan; its details appear in your account."),
    },
  };

  // Facts that are true for every order today (formerly the "Why Shashtna" block).
  const facts = [
    { icon: <Wallet size={15} aria-hidden />, label: t("سعر ومدة كل باقة واضحين قبل الطلب", "Every plan's price and duration shown before you order") },
    { icon: <ReceiptText size={15} aria-hidden />, label: t("كل طلب إله رقم وحالة تتحدث لحد التفعيل", "Every order has a number and a status until activation") },
    { icon: <BadgeCheck size={15} aria-hidden />, label: t("ما نطلب أبدًا رمز PIN أو CVV أو OTP", "We never ask for a PIN, CVV or OTP") },
  ];

  return (
    <section className="border-y border-line bg-surface/40 py-16 sm:py-20">
      <Container>
        <SectionHeading
          eyebrow={t("شلون تشتغل", "How it works")}
          title={t("من الاختيار للتفعيل بأربع خطوات", "From choosing to activation in four steps")}
          description={t(
            "نفس الخطوات اللي تشوفها على طلبك بحسابك، خطوة بخطوة.",
            "The same steps you'll see on your order in your account, one by one.",
          )}
        />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {JOURNEY_STEPS.map((step, index) => (
            <li key={step.key} className="surface relative rounded-card p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 text-glow">
                  {details[step.key].icon}
                </span>
                <span className="nums text-sm font-bold text-ink-3">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-5 text-base font-bold text-ink">{isAr ? step.ar : step.en}</h3>
              <p className="mt-2 text-sm leading-7 text-ink-2">{details[step.key].body}</p>
              {index < JOURNEY_STEPS.length - 1 ? (
                <span aria-hidden className="absolute -end-2.5 top-1/2 hidden h-px w-5 bg-gradient-to-l from-transparent via-line-strong to-transparent lg:block" />
              ) : null}
            </li>
          ))}
        </ol>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-2">
          {facts.map((fact) => (
            <li key={fact.label} className="inline-flex items-center gap-2">
              <span className="text-brand-ink">{fact.icon}</span>
              {fact.label}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
