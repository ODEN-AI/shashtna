import type { Metadata } from "next";
import { Check } from "lucide-react";

import { HelpHero } from "@/app/components/site/HelpHero";
import { LinkButton } from "@/app/ui/Button";
import { Container } from "@/app/ui/Page";
import { Notice } from "@/app/ui/States";
import { OrderStepper } from "@/app/ui/OrderStepper";
import { getI18n } from "@/src/server/i18n";
import { getSettings, manualTransferDetails, paymentMethodList } from "@/src/server/settings";

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
  const transfer = manualTransferDetails(settings);

  return (
    <>
      <HelpHero
        eyebrow={t("مركز المساعدة", "Help centre")}
        title={t("الدفع والطلبات", "Payment & orders")}
        description={t(
          "الدفع بشاشتنا بالتحويل اليدوي: تحوّل مبلغ الطلب، ترفع صورة إثبات الدفع، وفريقنا يراجعها قبل تفعيل اشتراكك.",
          "Payment at Shashtna is by manual transfer: you send the order amount, upload a screenshot as proof, and our team reviews it before activating your subscription.",
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
                t("تختار الباقة وتوصل لصفحة إتمام الطلب، وتشوف المبلغ المطلوب ورقم التحويل.", "Choose a plan and go to checkout, where you'll see the amount and the transfer number."),
                t("تحوّل المبلغ إلى رقم التحويل، وتلتقط صورة لإثبات العملية.", "Transfer the amount to the transfer number and take a screenshot of it."),
                t("ترفع صورة الإثبات وترسل الطلب. فريقنا يراجع الدفع، وبعد التأكد تتحول الحالة إلى «تم الدفع» ثم «قيد التفعيل».", "Upload the screenshot and send the order. Our team checks the payment; once confirmed the order moves to Paid, then Activating."),
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
          {transfer ? (
            <div className="surface-raised rounded-card border border-brand/40 p-6">
              <h2 className="font-bold text-ink">{t("تحويل يدوي", "Manual transfer")}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-ink-3">{t("رقم التحويل", "Transfer number")}</dt>
                  <dd dir="ltr" className="nums mt-1 select-all break-all text-start text-xl font-bold tracking-[0.1em] text-ink rtl:text-end">
                    {transfer.transferNumber}
                  </dd>
                </div>
                {transfer.recipientName ? (
                  <div>
                    <dt className="text-ink-3">{t("اسم الحساب", "Account name")}</dt>
                    <dd dir="ltr" className="mt-1 break-words text-start font-semibold text-ink rtl:text-end">
                      {transfer.recipientName}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-4 text-xs leading-6 text-ink-3">
                {t("المبلغ المطلوب يظهر بصفحة إتمام الطلب حسب الباقة اللي تختارها.", "The amount to pay is shown at checkout for the plan you choose.")}
              </p>
            </div>
          ) : null}
          {methods.length || instructions || !transfer ? (
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
          ) : null}
          <Notice tone="warning" title={t("تنبيه أمان", "Security note")}>
            {t(
              "فريق شاشتنا ما يطلب منك أبدًا كلمة مرور حسابك، ولا رمز PIN أو CVV أو رمز التحقق OTP لبطاقتك. تأكد أنك تتواصل ويانا عبر القنوات الموجودة بصفحة «تواصل ويانا».",
              "The Shashtna team will never ask for your account password, or your card's PIN, CVV or OTP code. Make sure you're talking to us through the channels on the Contact page.",
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
