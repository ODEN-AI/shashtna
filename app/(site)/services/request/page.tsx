"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, MessageCircle, Send, Sparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useLanguage } from "../../components/LanguageProvider";

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

  const openTelegram = () => {
    setSent(true);
    window.open(`${TELEGRAM_URL}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    openTelegram();
  };

  return (
    <main dir={isArabic ? "rtl" : "ltr"} className="min-h-[calc(100vh-1px)] overflow-hidden">
      <section className="relative border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[480px] w-[760px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-500/[0.10] blur-3xl dark:bg-blue-500/[0.11]" />
          <div className="absolute right-0 top-20 h-64 w-64 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 lg:px-8 lg:pb-24 lg:pt-16">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-sm font-black text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
          >
            <ArrowLeft size={16} className={isArabic ? "" : "rotate-180"} />
            {isArabic ? "العودة إلى الخدمات" : "Back to services"}
          </Link>

          <div className="mt-10 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="pt-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/70 px-4 py-2 text-[11px] font-black tracking-[0.18em] text-blue-700 shadow-sm backdrop-blur-xl dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                <Sparkles size={14} />
                {isArabic ? "شاشتنا للحلول الرقمية" : "SHASHTNA DIGITAL SOLUTIONS"}
              </div>

              <h1 className="mt-7 text-4xl font-black leading-tight tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                {isArabic ? (
                  <>
                    خلّينا نناقش
                    <span className="block bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-cyan-300 dark:to-cyan-400">
                      مشروعك.
                    </span>
                  </>
                ) : (
                  <>
                    Let’s discuss
                    <span className="block bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-cyan-300 dark:to-cyan-400">
                      your project.
                    </span>
                  </>
                )}
              </h1>

              <p className="mt-6 max-w-xl text-sm leading-8 text-slate-500 dark:text-slate-400 sm:text-base">
                {isArabic
                  ? "أرسل لنا فكرة مشروعك والمتطلبات الأساسية، ونكمل النقاش معك ونحدد النطاق والخطوات والتسعير المناسب."
                  : "Send us the idea and key requirements. We’ll discuss the scope, next steps and a suitable quote with you."}
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  isArabic ? "فهم المتطلبات" : "Understand the requirements",
                  isArabic ? "تحديد نطاق واضح" : "Define a clear scope",
                  isArabic ? "اقتراح الحل المناسب" : "Recommend the right solution",
                  isArabic ? "عرض سعر مخصص" : "Custom project quote",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                    <CheckCircle2 size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={submit}
              className="rounded-[30px] border border-slate-200/80 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/70 dark:shadow-black/25 sm:p-8"
            >
              <div className="grid gap-5 sm:grid-cols-2">
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

                <div className="sm:col-span-2">
                  <Field label={isArabic ? "المدة المطلوبة" : "Required timeline"} value={timeline} onChange={setTimeline} placeholder={isArabic ? "مثلاً: خلال شهر" : "e.g. within one month"} />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {isArabic ? "تفاصيل المشروع" : "Project details"}
                  </label>
                  <textarea
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    rows={7}
                    placeholder={isArabic ? "اشرح فكرتك، الوظائف المطلوبة، وأي تفاصيل تساعدنا نفهم المشروع." : "Describe the idea, required features and anything that helps us understand the project."}
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
              >
                <Send size={17} />
                {isArabic ? "إرسال ومناقشة المشروع" : "Send & discuss the project"}
              </button>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a
                  href={MESSENGER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                >
                  <MessageCircle size={16} />
                  {isArabic ? "مراسلة عبر Facebook" : "Message on Facebook"}
                </a>
                <a
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15"
                >
                  <Send size={16} />
                  {isArabic ? "فتح Telegram" : "Open Telegram"}
                </a>
              </div>

              {sent && (
                <p className="mt-4 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {isArabic ? "تم تجهيز الرسالة وفتح Telegram لإكمال الإرسال." : "Your message is ready in Telegram."}
                </p>
              )}
            </form>
          </div>
        </div>
      </section>
    </main>
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
  return (
    <div>
      <label className="text-xs font-black text-slate-700 dark:text-slate-200">{label}</label>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white"
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
  return (
    <div>
      <label className="text-xs font-black text-slate-700 dark:text-slate-200">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
