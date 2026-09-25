/**
 * Help-centre content. Every answer describes how Shashtna works today
 * (manual payment arranged with the team, activation by staff, credentials
 * in the account). Update these answers when the process changes.
 */

export type Bilingual = { ar: string; en: string };

export type FaqItem = { id: string; q: Bilingual; a: Bilingual; topic: "start" | "payment" | "account" | "watch" };

export const FAQ: FaqItem[] = [
  {
    id: "how-to-subscribe",
    topic: "start",
    q: { ar: "شلون أشترك بشاشتنا؟", en: "How do I subscribe?" },
    a: {
      ar: "اختار الباقة المناسبة، سجّل دخولك أو أنشئ حساب، وأكّد الطلب. بعدها تنتقل لحسابك، تحوّل المبلغ إلى رقم التحويل الظاهر وترفع صورة إثبات الدفع. فريقنا يراجع الدفع، وبعد تأكيده يتم تفعيل اشتراكك وتلگى تفاصيله بحسابك.",
      en: "Pick a plan, sign in or create an account, and confirm the order. You then go to your account, transfer the amount to the transfer number shown and upload a screenshot of the payment. Our team reviews it, and once confirmed your subscription is activated and appears in your account.",
    },
  },
  {
    id: "payment",
    topic: "payment",
    q: { ar: "شلون أدفع؟ هل أكدر أدفع بالبطاقة بالموقع؟", en: "How do I pay? Can I pay by card on the website?" },
    a: {
      ar: "الدفع حاليًا بالتحويل اليدوي: بعد تأكيد الطلب تحوّل مبلغه إلى رقم التحويل الظاهر بحسابك، وترفع صورة إثبات الدفع، وفريقنا يراجعها قبل التفعيل. ماكو دفع مباشر بالبطاقة داخل الموقع، وما نطلب منك أبدًا رمز PIN أو CVV أو رمز التحقق OTP.",
      en: "Payment is currently by manual transfer: after confirming your order, send the amount to the transfer number shown in your account, upload a screenshot as proof, and our team reviews it before activation. There's no direct card payment on the website, and we never ask for your PIN, CVV or OTP code.",
    },
  },
  {
    id: "activation",
    topic: "start",
    q: { ar: "شكد ياخذ التفعيل؟", en: "How long does activation take?" },
    a: {
      ar: "بعد تأكيد الدفع يجهز فريقنا اشتراكك يدويًا. تكدر تتابع كل مرحلة من صفحة الطلب بحسابك: تم الإرسال، بانتظار الدفع، تم الدفع، قيد التفعيل، مكتمل.",
      en: "Once payment is confirmed, our team prepares your subscription by hand. You can follow each step on the order page in your account: submitted, awaiting payment, paid, activating, completed.",
    },
  },
  {
    id: "iptv-vs-vip",
    topic: "start",
    q: { ar: "شنو الفرق بين IPTV وVIP؟", en: "What's the difference between IPTV and VIP?" },
    a: {
      ar: "باقات IPTV تعطيك بيانات دخول (اسم مستخدم وكلمة مرور) تستخدمها على التطبيقات والأجهزة المدعومة. باقات VIP تكون مع جهاز VIP مخصص يرتبط باشتراكك، وسعر الطلب يشمل الباقة والجهاز.",
      en: "IPTV plans give you login details (username and password) to use on supported apps and devices. VIP plans come with a dedicated VIP device linked to your subscription, and the order price covers both the plan and the device.",
    },
  },
  {
    id: "credentials",
    topic: "account",
    q: { ar: "وين ألگى بيانات الدخول مال اشتراكي؟", en: "Where do I find my subscription login details?" },
    a: {
      ar: "بعد التفعيل، افتح «اشتراكاتي» بحسابك واختار الاشتراك. بيانات الدخول تبقى مخفية لحد ما تضغط «إظهار»، وتكدر تنسخها مباشرة.",
      en: "After activation, open Subscriptions in your account and select the subscription. Login details stay hidden until you tap Show, and you can copy them directly.",
    },
  },
  {
    id: "renew",
    topic: "account",
    q: { ar: "شلون أجدد اشتراكي؟", en: "How do I renew?" },
    a: {
      ar: "من صفحة الاشتراك اضغط «تجديد» واختار المدة. إذا جددت قبل الانتهاء، المدة الجديدة تنضاف من تاريخ انتهاء اشتراكك الحالي فما تخسر أي يوم.",
      en: "On the subscription page tap Renew and pick a duration. If you renew before it ends, the new period is added from your current expiry date, so you don't lose any days.",
    },
  },
  {
    id: "devices",
    topic: "watch",
    q: { ar: "على أي أجهزة أكدر أشاهد؟", en: "Which devices can I watch on?" },
    a: {
      ar: "شوف صفحة «شاهد على» — بيها الأجهزة والمنصات المدعومة والتطبيق المناسب لكل وحدة، مع روابط التحميل وخطوات الإعداد.",
      en: "See the Watch on page — it lists supported devices and platforms, the right app for each, download links and setup steps.",
    },
  },
  {
    id: "forgot-password",
    topic: "account",
    q: { ar: "نسيت كلمة المرور، شسوي؟", en: "I forgot my password. What do I do?" },
    a: {
      ar: "من صفحة تسجيل الدخول اضغط «نسيت كلمة المرور؟» واكتب رقم هاتفك. فريقنا يتأكد من هويتك ويعطيك رمز لمرة وحدة تستخدمه لتعيين كلمة مرور جديدة.",
      en: "On the sign-in page tap “Forgot password?” and enter your phone number. Our team verifies it's you and gives you a one-time code to set a new password.",
    },
  },
  {
    id: "cancel-order",
    topic: "payment",
    q: { ar: "أكدر ألغي طلب؟", en: "Can I cancel an order?" },
    a: {
      ar: "إي، تكدر تلغي الطلب من صفحته بحسابك ما دام الدفع ما تأكد بعد. بعد تأكيد الدفع تواصل ويا الدعم.",
      en: "Yes — you can cancel from the order page in your account as long as payment hasn't been confirmed. After that, contact support.",
    },
  },
  {
    id: "support",
    topic: "account",
    q: { ar: "شلون أتواصل ويا الدعم؟", en: "How do I contact support?" },
    a: {
      ar: "أسرع طريقة هي تذكرة دعم من حسابك — تنربط تلقائيًا باشتراكك وتوصلك إشعارات الرد. وتكدر تتواصل ويانا أيضًا عبر القنوات الموجودة بصفحة «تواصل ويانا».",
      en: "The fastest way is a support ticket from your account — it's linked to your subscription and you get notified of replies. You can also reach us through the channels on the Contact page.",
    },
  },
];

export type TroubleshootingGuide = {
  id: string;
  category: "playback" | "app" | "subscription" | "device";
  title: Bilingual;
  symptoms: Bilingual;
  steps: Bilingual[];
};

export const TROUBLESHOOTING: TroubleshootingGuide[] = [
  {
    id: "buffering",
    category: "playback",
    title: { ar: "التقطيع أو التحميل البطيء", en: "Buffering or slow loading" },
    symptoms: { ar: "القناة تتوقف أو تحمّل كثير.", en: "Channels pause or keep loading." },
    steps: [
      { ar: "جرب قناة ثانية حتى تتأكد إذا المشكلة بقناة وحدة أو بكل القنوات.", en: "Try another channel to see whether it's one channel or all of them." },
      { ar: "أعد تشغيل الراوتر والجهاز، واترك الجهاز قريب من الراوتر أو استخدم كيبل.", en: "Restart your router and device; keep the device close to the router or use a cable." },
      { ar: "سكّر التطبيق بالكامل وافتحه من جديد.", en: "Fully close the app and open it again." },
      { ar: "شوف صفحة «حالة الخدمة» — إذا اكو عطل معلن، الفريق يشتغل عليه.", en: "Check the Service status page — if an incident is announced, the team is on it." },
    ],
  },
  {
    id: "login-failed",
    category: "subscription",
    title: { ar: "التطبيق ما يقبل بيانات الدخول", en: "The app rejects my login" },
    symptoms: { ar: "رسالة خطأ عند إدخال اسم المستخدم وكلمة المرور.", en: "An error when entering the username and password." },
    steps: [
      { ar: "انسخ البيانات من «اشتراكاتي» بحسابك بدل كتابتها يدويًا، وانتبه للحروف الكبيرة والمسافات.", en: "Copy the details from Subscriptions in your account instead of typing them; watch for capital letters and spaces." },
      { ar: "تأكد أن اشتراكك نشط وما منتهي من صفحة الاشتراك.", en: "Check on the subscription page that it's active and not expired." },
      { ar: "إذا استمرت المشكلة، افتح تذكرة دعم من صفحة الاشتراك حتى تنربط تلقائيًا بيه.", en: "If it persists, open a support ticket from the subscription page so it's linked automatically." },
    ],
  },
  {
    id: "install-app",
    category: "app",
    title: { ar: "التطبيق ما يتنصب على أندرويد", en: "The app won't install on Android" },
    symptoms: { ar: "رسالة حظر أو فشل التثبيت عند فتح ملف APK.", en: "A blocked or failed install when opening the APK." },
    steps: [
      { ar: "حمّل التطبيق من الرابط الموجود بصفحة التطبيقات فقط.", en: "Only download the app from the link on the Apps page." },
      { ar: "من إعدادات الجهاز فعّل السماح بتثبيت التطبيقات من هذا المصدر (مصادر غير معروفة) للمتصفح أو مدير الملفات.", en: "In your device settings, allow installs from this source (unknown sources) for the browser or file manager." },
      { ar: "تأكد من وجود مساحة كافية بالجهاز وأعد المحاولة.", en: "Make sure there's enough free storage and try again." },
    ],
  },
  {
    id: "expired",
    category: "subscription",
    title: { ar: "الاشتراك توقف فجأة", en: "My subscription stopped working" },
    symptoms: { ar: "كان يشتغل وتوقف.", en: "It worked and then stopped." },
    steps: [
      { ar: "افتح «اشتراكاتي» وشوف تاريخ الانتهاء — إذا منتهي، جدّده من نفس الصفحة.", en: "Open Subscriptions and check the expiry date — if it has expired, renew from the same page." },
      { ar: "إذا عندك طلب تجديد قيد المعالجة، تابع حالته من «الطلبات».", en: "If a renewal order is in progress, follow its status under Orders." },
    ],
  },
  {
    id: "vip-device",
    category: "device",
    title: { ar: "جهاز VIP ما يشتغل", en: "My VIP device isn't working" },
    symptoms: { ar: "الجهاز ما يعرض المحتوى.", en: "The device doesn't show content." },
    steps: [
      { ar: "أطفئ الجهاز وافصله من الكهرباء دقيقة، ثم شغّله.", en: "Power the device off and unplug it for a minute, then turn it on." },
      { ar: "تأكد من اتصاله بالإنترنت من إعدادات الشبكة بالجهاز.", en: "Check its internet connection in the device's network settings." },
      { ar: "افتح تذكرة دعم واذكر رقم الجهاز (Device ID) الظاهر بصفحة اشتراكك.", en: "Open a support ticket and include the Device ID shown on your subscription page." },
    ],
  },
];
