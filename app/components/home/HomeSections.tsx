import Link from "next/link";
import { ArrowLeft, BellRing, Headphones, KeyRound, RefreshCw } from "lucide-react";

import { FAQ } from "@/src/content/help";
import { translator, type Lang } from "@/src/lib/i18n";

import s from "./home.module.css";

/** How subscribing works, in the order the customer does it. */
export function HomeSteps({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const steps = [
    {
      title: t("اختار باقتك", "Choose your plan"),
      body: t("IPTV على جهازك الحالي، أو VIP ويا جهاز مخصص. السعر يبيّن كامل قبل التأكيد.", "IPTV on the device you have, or VIP with a dedicated device. The full price shows before you confirm."),
    },
    {
      title: t("حوّل وارفع الإثبات", "Transfer and upload the proof"),
      body: t("على رقم التحويل الظاهر بحسابك. ما نطلب منك رمز PIN أو CVV أو OTP أبدًا.", "To the transfer number in your account. We never ask for a PIN, CVV or OTP."),
    },
    {
      title: t("نفعّل وتشاهد", "We activate, you watch"),
      body: t("فريقنا يراجع الدفع ويفعّل اشتراكك، وتلگى بيانات الدخول بصفحة اشتراكك.", "Our team checks the payment and activates it; your sign-in details are on your subscription page."),
    },
  ];

  return (
    <section className={`${s.wrap} ${s.sectionTight}`} aria-labelledby="home-steps-title">
      <p className={s.kicker}>{t("طريقة الاشتراك", "How it works")}</p>
      <h2 id="home-steps-title" className={s.h2}>
        {t("ثلاث خطوات وتبدأ", "Three steps and you are watching")}
      </h2>
      <ol className={s.how}>
        {steps.map((step, index) => (
          <li key={step.title} className={`${s.card} ${s.howCard}`} style={{ listStyle: "none" }}>
            <span className={`${s.howNum} nums`} aria-hidden>
              {index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** What the customer account does after the purchase. */
export function HomeAccountPreview({ lang, signedIn }: { lang: Lang; signedIn: boolean }) {
  const t = translator(lang);
  const feats = [
    { icon: <BellRing size={20} />, text: t("تاريخ انتهاء كل اشتراك والأيام المتبقية", "Each subscription's expiry and the days left") },
    { icon: <RefreshCw size={20} />, text: t("تجديد بضغطة، والمدة تنضاف من تاريخ الانتهاء", "Renew in one tap; time is added from the expiry date") },
    { icon: <KeyRound size={20} />, text: t("بيانات الدخول مخفية لحد ما تضغط «إظهار»", "Sign-in details stay hidden until you tap Show") },
    { icon: <Headphones size={20} />, text: t("تذاكر الدعم ومتابعة الردود", "Support tickets and their replies") },
  ];

  return (
    <section className={`${s.wrap} ${s.sectionTight}`} aria-labelledby="home-account-title">
      <div className={s.account}>
        <div>
          <p className={s.kicker}>{t("حسابي", "My Shashtna")}</p>
          <h2 id="home-account-title" className={s.h2}>
            {t("اشتراكك كله بمكان واحد", "Your subscription, all in one place")}
          </h2>
          <ul className={s.feats}>
            {feats.map((feat) => (
              <li key={feat.text} className={s.feat} style={{ listStyle: "none" }}>
                <span className={s.featIcon} aria-hidden>
                  {feat.icon}
                </span>
                {feat.text}
              </li>
            ))}
          </ul>
          <div className={s.actions}>
            <Link href={signedIn ? "/dashboard" : "/register"} className={`${s.btn} ${s.btnPrimary}`}>
              {signedIn ? t("افتح حسابي", "Open My Shashtna") : t("أنشئ حسابك", "Create your account")}
              <span className={s.btnArrow} aria-hidden>
                <ArrowLeft size={18} className="ltr:rotate-180" />
              </span>
            </Link>
          </div>
        </div>
        <div>
          <div className={s.laptopScreen}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/account-preview.jpg" alt={t("لوحة حسابي بموقع شاشتنا", "The My Shashtna dashboard")} width={600} height={380} loading="lazy" />
          </div>
          <div className={s.laptopBase} aria-hidden />
        </div>
      </div>
    </section>
  );
}

/** Five real help-centre answers. */
export function HomeQuestions({ lang }: { lang: Lang }) {
  const t = translator(lang);

  return (
    <section className={`${s.wrap} ${s.sectionTight}`} aria-labelledby="home-faq-title">
      <div className={s.faq}>
        <div>
          <p className={s.kicker}>{t("الأسئلة الشائعة", "Questions")}</p>
          <h2 id="home-faq-title" className={s.h2}>
            {t("قبل ما تشترك", "Before you subscribe")}
          </h2>
          <p className={s.lead} style={{ marginTop: 14 }}>
            {t("ما لگيت جوابك؟ مركز المساعدة بيه حلول لأكثر المشاكل.", "No answer here? The help centre covers the most common issues.")}
          </p>
          <div className={s.actions}>
            <Link href="/help" className={`${s.btn} ${s.btnGhost}`}>
              {t("مركز المساعدة", "Help centre")}
            </Link>
          </div>
        </div>
        <div>
          {FAQ.slice(0, 5).map((item, index) => (
            <details key={item.id} className={s.question} open={index === 0}>
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
      </div>
    </section>
  );
}

/** The closing call to action. */
export function HomeCtaBand({ lang }: { lang: Lang }) {
  const t = translator(lang);

  return (
    <section className={`${s.wrap} ${s.sectionTight}`} aria-labelledby="home-cta-title">
      <div className={s.band}>
        <div>
          <h2 id="home-cta-title">
            {t("شاشتك جاهزة؟", "Your screen is ready?")}
            <br />
            {t("ابدأ اليوم", "Start today")}
          </h2>
          <p>{t("اختار باقتك وخلي الباقي علينا.", "Pick your plan and leave the rest to us.")}</p>
          <div className={s.actions}>
            <Link href="/plans" className={`${s.btn} ${s.btnWhite}`}>
              {t("اختار باقتك", "Choose your plan")}
            </Link>
            <Link href="/help/contact" className={`${s.btn} ${s.btnGhost}`}>
              {t("تواصل ويانا", "Contact us")}
            </Link>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/packages-preview.jpg" alt="" width={960} height={600} loading="lazy" />
      </div>
    </section>
  );
}
