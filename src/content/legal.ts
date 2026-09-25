import type { Bilingual } from "./help";

/**
 * Draft outlines shown on the legal pages until an admin saves the final,
 * reviewed text in Admin → Settings. They only describe how the service
 * works today and are always displayed with a "draft" notice.
 */
export type LegalDraft = { heading: Bilingual; body: Bilingual }[];

export const TERMS_DRAFT: LegalDraft = [
  {
    heading: { ar: "الحساب", en: "Your account" },
    body: {
      ar: "تنشئ حسابك باسمك ورقم هاتفك وكلمة مرور. أنت مسؤول عن الحفاظ على سرية كلمة المرور وعن الطلبات المرسلة من حسابك.",
      en: "You create your account with your name, phone number and a password. You're responsible for keeping your password private and for orders placed from your account.",
    },
  },
  {
    heading: { ar: "الطلبات والدفع", en: "Orders and payment" },
    body: {
      ar: "إرسال الطلب لا يعني تفعيل الاشتراك. الدفع يتم بالتنسيق ويا فريق شاشتنا، ويبدأ التفعيل بعد تأكيد الدفع. الأسعار المعروضة بالدينار العراقي.",
      en: "Submitting an order does not activate a subscription. Payment is arranged with the Shashtna team, and activation starts once payment is confirmed. Prices are shown in Iraqi dinars.",
    },
  },
  {
    heading: { ar: "الاشتراك", en: "Subscriptions" },
    body: {
      ar: "مدة الاشتراك تبدأ من تاريخ التفعيل وتنتهي بالتاريخ الظاهر بحسابك. بيانات الدخول للاستخدام الشخصي حسب عدد الاتصالات المسموح بباقتك.",
      en: "A subscription runs from its activation date to the expiry date shown in your account. Login details are for personal use within the number of connections your plan allows.",
    },
  },
  {
    heading: { ar: "التجديد", en: "Renewal" },
    body: {
      ar: "التجديد يتم بطلب جديد من حسابك. إذا جددت قبل الانتهاء، المدة الجديدة تنضاف من تاريخ الانتهاء الحالي.",
      en: "Renewal is a new order from your account. If you renew before expiry, the new period is added from the current expiry date.",
    },
  },
];

export const PRIVACY_DRAFT: LegalDraft = [
  {
    heading: { ar: "البيانات اللي نجمعها", en: "Data we collect" },
    body: {
      ar: "الاسم ورقم الهاتف والبريد الإلكتروني إن وُجد، كلمة المرور بشكل مشفّر (لا نستطيع قراءتها)، تفاصيل طلباتك واشتراكاتك وإيصالاتك، ورسائل الدعم الفني.",
      en: "Your name, phone number and email if provided, your password in hashed form (we can't read it), details of your orders, subscriptions and receipts, and your support messages.",
    },
  },
  {
    heading: { ar: "ليش نستخدمها", en: "Why we use it" },
    body: {
      ar: "لتنفيذ طلباتك، تفعيل وإدارة اشتراكك، التواصل وياك بخصوص الدفع والدعم، وعرض المعلومات بحسابك.",
      en: "To process your orders, activate and manage your subscription, contact you about payment and support, and show information in your account.",
    },
  },
  {
    heading: { ar: "ملفات تعريف الارتباط", en: "Cookies" },
    body: {
      ar: "نستخدم ملف تعريف ارتباط لجلسة تسجيل الدخول وآخر لحفظ لغة الموقع. ما نستخدم ملفات إعلانية.",
      en: "We use one cookie for your sign-in session and one to remember the site language. We don't use advertising cookies.",
    },
  },
  {
    heading: { ar: "المشاركة", en: "Sharing" },
    body: {
      ar: "ما نبيع بياناتك. يطّلع عليها فريق شاشتنا بقدر ما يحتاج لخدمتك.",
      en: "We don't sell your data. The Shashtna team accesses it only as needed to serve you.",
    },
  },
];

export const REFUND_DRAFT: LegalDraft = [
  {
    heading: { ar: "قبل تأكيد الدفع", en: "Before payment is confirmed" },
    body: {
      ar: "تكدر تلغي طلبك من صفحته بحسابك بدون أي التزام ما دام الدفع ما تأكد.",
      en: "You can cancel your order from its page in your account at no cost as long as payment hasn't been confirmed.",
    },
  },
  {
    heading: { ar: "بعد تأكيد الدفع", en: "After payment is confirmed" },
    body: {
      ar: "تواصل ويا الدعم الفني. سياسة الاسترجاع النهائية راح تُنشر هنا بعد اعتمادها.",
      en: "Contact support. The final refund policy will be published here once approved.",
    },
  },
];
