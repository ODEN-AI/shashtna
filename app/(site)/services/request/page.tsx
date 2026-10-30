"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, MessageCircle, Send, Sparkles } from "lucide-react";
import { FormEvent, useId, useMemo, useState } from "react";
import s from "@/app/components/home/home.module.css";
import v from "@/app/components/site/services.module.css";

import { useLanguage } from "../../components/LanguageProvider";
import { submitServiceLead } from "../actions";

const TELEGRAM_URL = "https://t.me/shashtna";
const MESSENGER_URL = "https://www.facebook.com/profile.php?id=61594341596034";

const projectTypesAr = [
  "موقع إلكتروني",
  "متجر إلكتروني",
  "تطبيق Android",
  "Android TV / Google TV",
  "حل IPTV / Streaming",
  "منصة أو نظام مخصص",
];

const projectTypesEn = [
  "Website",
  "E-Commerce",
  "Android App",
  "Android TV / Google TV",
  "IPTV / Streaming Solution",
  "Custom Platform / System",
];

const budgetsAr = [
  "أقل من 500,000 د.ع",
  "500,000 – 1,000,000 د.ع",
  "1,000,000 – 2,000,000 د.ع",
  "2,000,000 – 4,000,000 د.ع",
  "أكثر من 4,000,000 د.ع",
  "غير محددة بعد",
];

const budgetsEn = [
  "Under IQD 500,000",
  "IQD 500,000 – 1,000,000",
  "IQD 1,000,000 – 2,000,000",
  "IQD 2,000,000 – 4,000,000",
  "Above IQD 4,000,000",
  "Not decided yet",
];

export default function ServicesRequestPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const projectTypes = isArabic ? projectTypesAr : projectTypesEn;
  const budgets = isArabic ? budgetsAr : budgetsEn;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [projectType, setProjectType] = useState(projectTypes[0]);
  const [budget, setBudget] = useState(budgets[0]);
  const [timeline, setTimeline] = useState("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const detailsId = useId();

  const message = useMemo(() => {
    if (isArabic) {
      return `السلام عليكم، أريد مناقشة مشروع مع شاشتنا.

الاسم: ${name || "غير مذكور"}
رقم التواصل: ${phone || "غير مذكور"}
نوع المشروع: ${projectType}
الميزانية التقريبية: ${budget}
المدة المطلوبة: ${timeline || "غير محددة"}

تفاصيل المشروع:
${details || "غير مذكورة بعد"}`;
    }

    return `Hello, I would like to discuss a project with Shashtna.

Name: ${name || "Not provided"}
Contact: ${phone || "Not provided"}
Project type: ${projectType}
Approx. budget: ${budget}
Required timeline: ${timeline || "Not decided"}

Project details:
${details || "Not provided yet"}`;
  }, [budget, details, isArabic, name, phone, projectType, timeline]);

  const telegramHref = `${TELEGRAM_URL}?text=${encodeURIComponent(message)}`;

  // Save the lead first so it is never lost, then let the visitor continue
  // on Telegram with a normal link tap (popup blockers stop window.open
  // after an await on mobile).
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await submitServiceLead({ name, phone, projectType, budget, timeline, details });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSent(true);
    } catch {
      setError(isArabic ? "تعذر إرسال الطلب، حاول مرة ثانية." : "Couldn't send the request. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    // -mt-[80px]/pt-[80px]: the navy ground runs up behind the floating header.
    <div dir={isArabic ? "rtl" : "ltr"} className={`${s.home} -mt-[80px] pt-[80px] pb-16`}>
      <div className={s.wrap}>
        <Link href="/services" className={v.back}>
          <ArrowLeft size={16} className={isArabic ? "rotate-180" : ""} aria-hidden />
          {isArabic ? "العودة إلى الخدمات" : "Back to services"}
        </Link>

        <div className={v.request}>
          <section className={v.requestSide} aria-labelledby="request-title">
            <span className={v.badge}>
              <Sparkles size={15} aria-hidden />
              {isArabic ? "شاشتنا للحلول الرقمية" : "Shashtna Digital Solutions"}
            </span>
            <h1 id="request-title" className={v.title}>
              {isArabic ? "خلّينا نناقش" : "Let’s discuss"}
              <span className={s.hl}>{isArabic ? "مشروعك." : "your project."}</span>
            </h1>
            <p className={v.lead}>
              {isArabic
                ? "أرسل لنا فكرة مشروعك والمتطلبات الأساسية، ونكمل النقاش معك ونحدد النطاق والخطوات والتسعير المناسب."
                : "Send us the idea and key requirements. We’ll discuss the scope, next steps and a suitable quote with you."}
            </p>
            <ul className={v.points}>
              {[
                isArabic ? "فهم المتطلبات" : "Understand the requirements",
                isArabic ? "تحديد نطاق واضح" : "Define a clear scope",
                isArabic ? "اقتراح الحل المناسب" : "Recommend the right solution",
                isArabic ? "عرض سعر مخصص" : "Custom project quote",
              ].map((item) => (
                <li key={item}>
                  <span className={v.tick}>
                    <CheckCircle2 size={14} aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <form onSubmit={submit} className={v.form}>
            <div className={v.fields}>
              <Field label={isArabic ? "الاسم" : "Name"} value={name} onChange={setName} placeholder={isArabic ? "اسمك" : "Your name"} required />
              <Field label={isArabic ? "رقم التواصل" : "Contact number"} value={phone} onChange={setPhone} placeholder={isArabic ? "رقم الهاتف أو WhatsApp" : "Phone or WhatsApp"} required />

              <SelectField
                label={isArabic ? "نوع المشروع" : "Project type"}
                value={projectType}
                onChange={setProjectType}
                options={projectTypes}
              />
              <SelectField
                label={isArabic ? "الميزانية التقريبية" : "Approx. budget"}
                value={budget}
                onChange={setBudget}
                options={budgets}
              />

              <div className={v.wide}>
                <Field label={isArabic ? "المدة المطلوبة" : "Required timeline"} value={timeline} onChange={setTimeline} placeholder={isArabic ? "مثلاً: خلال شهر" : "e.g. within one month"} />
              </div>

              <div className={v.wide}>
                <label htmlFor={detailsId} className={v.label}>
                  {isArabic ? "تفاصيل المشروع" : "Project details"}
                </label>
                <textarea
                  id={detailsId}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={7}
                  placeholder={isArabic ? "اشرح فكرتك، الوظائف المطلوبة، وأي تفاصيل تساعدنا نفهم المشروع." : "Describe the idea, required features and anything that helps us understand the project."}
                  className={v.input}
                />
              </div>
            </div>

            {error ? (
              <p role="alert" className={v.alert}>
                {error}
              </p>
            ) : null}

            {sent ? (
              <div role="status" className={v.sent}>
                <p>{isArabic ? "وصلنا طلبك وراح نتواصل وياك." : "We received your request and will get in touch."}</p>
                <a href={telegramHref} target="_blank" rel="noopener noreferrer" className={`${s.btn} ${s.btnPrimary}`}>
                  <Send size={17} aria-hidden />
                  {isArabic ? "كمّل النقاش على Telegram" : "Continue on Telegram"}
                </a>
              </div>
            ) : null}

            <button type="submit" disabled={saving || sent} className={`${s.btn} ${s.btnPrimary} ${v.submit}`}>
              <Send size={18} aria-hidden />
              {saving
                ? isArabic ? "جاري الإرسال..." : "Sending..."
                : isArabic ? "إرسال ومناقشة المشروع" : "Send & discuss the project"}
            </button>

            <div className={v.channels}>
              <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer" className={`${s.btn} ${s.btnGhost}`}>
                <MessageCircle size={17} aria-hidden />
                {isArabic ? "مراسلة عبر Facebook" : "Message on Facebook"}
              </a>
              <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={`${s.btn} ${s.btnGhost}`}>
                <Send size={17} aria-hidden />
                {isArabic ? "فتح Telegram" : "Open Telegram"}
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className={v.label}>{label}</label>
      <input
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={v.input}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className={v.label}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={v.input}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
