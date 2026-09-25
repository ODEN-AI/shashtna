import type { Metadata } from "next";
import { Check } from "lucide-react";

import { HelpHero } from "@/app/components/site/HelpHero";
import { LinkButton } from "@/app/ui/Button";
import { Container } from "@/app/ui/Page";
import { Notice } from "@/app/ui/States";
import { OrderStepper } from "@/app/ui/OrderStepper";
import { getI18n } from "@/src/server/i18n";
import { getSettings, paymentMethodList } from "@/src/server/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "طرق الدفع",
  description: "شلون يتم الدفع لاشتراكات شاشتنا وشلون تتابع حالة طلبك.",
  alternates: { canonical: "/help/payment" },
};

export default async function PaymentPage() {
  const [{ t, lang }, settings] = await Promise.all([getI18n(), getSettings()]);
  const methods = paymentMethodList(settings);
  const instructions = settings["payment.instructions"].trim();

  return (
    <>
      <HelpHero
        eyebrow={t("مركز المساعدة", "Help centre")}
        title={t("الدفع والطلبات", "Payment & orders")}
        description={t(
          "الدفع بشاشتنا يتم بالتنسيق المباشر ويا فريقنا بعد إرسال الطلب. ماكو دفع إلكتروني بالبطاقة داخل الموقع حاليًا.",
          "Payment at Shashtna is arranged directly with our team after you submit your order. There is no online card payment on the website at the moment.",
        )}
      />
      <Container className="grid gap-8 py-14 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-8">
          <section className="surface rounded-panel p-6 sm:p-8">
            <h2 className="text-xl font-bold text-ink">{t("مراحل الطلب", "Order stages")}</h2>
            <p className="mt-2 text-sm leading-7 text-ink-2">
              {t("كل طلب يمر بهاي المراحل، وتكدر تتابعها من صفحة الطلب بحسابك.", "Every order goes through these stages, which you can follow on the order page in your account.")}
            </p>
            <div className="mt-8">
              <OrderStepper status="SUBMITTED" lang={lang} />
            </div>
          </section>

          <section className="surface rounded-panel p-6 sm:p-8">
            <h2 className="text-xl font-bold text-ink">{t("شلون يتم الدفع", "How payment works")}</h2>
            <ol className="mt-5 space-y-3 text-sm leading-7 text-ink-2">
              {[
                t("ترسل الطلب من الموقع وتختار طريقة التواصل المناسبة إلك.", "You submit the order on the website and choose how you'd like to be contacted."),
                t("فريقنا يتواصل وياك ويتفق وياك على طريقة الدفع.", "Our team contacts you and agrees the payment method with you."),
                t("بعد تأكيد الدفع تتحول حالة الطلب إلى «تم الدفع» ثم «قيد التفعيل».", "Once payment is confirmed the order moves to Paid, then Activating."),
                t("عند التفعيل تلگى تفاصيل اشتراكك وإيصال الدفع بحسابك.", "On activation you'll find your subscription details and receipt in your account."),
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="nums flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{index + 1}</span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="surface rounded-card p-6">
            <h2 className="font-bold text-ink">{t("طرق الدفع المتاحة", "Available payment methods")}</h2>
            {methods.length ? (
              <ul className="mt-4 space-y-2.5">
                {methods.map((method) => (
                  <li key={method} className="flex items-center gap-2.5 text-sm text-ink-2">
                    <Check size={16} className="text-success" aria-hidden />
                    {method}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-7 text-ink-2">
                {t("فريقنا يوضح لك طرق الدفع المتاحة عند التواصل بخصوص طلبك.", "Our team explains the available payment methods when they contact you about your order.")}
              </p>
            )}
            {instructions ? <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-sm leading-7 text-ink-2">{instructions}</p> : null}
          </div>
          <Notice tone="warning" title={t("تنبيه أمان", "Security note")}>
            {t(
              "فريق شاشتنا ما يطلب منك كلمة مرور حسابك أبدًا. تأكد أنك تتواصل ويانا عبر القنوات الموجودة بصفحة «تواصل ويانا».",
              "The Shashtna team will never ask for your account password. Make sure you're talking to us through the channels on the Contact page.",
            )}
          </Notice>
          <LinkButton href="/plans" className="w-full">
            {t("شوف الباقات", "See plans")}
          </LinkButton>
        </aside>
      </Container>
    </>
  );
}
