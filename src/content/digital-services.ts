/**
 * Shashtna's digital services, summarised for the home and about pages.
 * The full catalogue with prices lives on /services; keep these in line with
 * what that page offers.
 */
export type DigitalServiceArea = {
  id: "apps" | "web" | "platforms" | "custom";
  title: { ar: string; en: string };
  body: { ar: string; en: string };
};

export const DIGITAL_SERVICE_AREAS: DigitalServiceArea[] = [
  {
    id: "apps",
    title: { ar: "تطبيقات الموبايل والتلفاز", en: "Mobile and TV apps" },
    body: {
      ar: "تطبيقات أندرويد وتطبيقات للشاشات الذكية، مبنية حول فكرة مشروعك.",
      en: "Android and Android TV / Google TV apps built around your idea.",
    },
  },
  {
    id: "web",
    title: { ar: "مواقع الويب", en: "Websites" },
    body: {
      ar: "من صفحات الهبوط إلى مواقع الشركات والمتاجر الإلكترونية.",
      en: "From landing pages to business sites and online stores.",
    },
  },
  {
    id: "platforms",
    title: { ar: "أنظمة ومنصات رقمية", en: "Digital platforms" },
    body: {
      ar: "منصات مخصصة، لوحات إدارة، وحلول IPTV وStreaming.",
      en: "Custom platforms, admin dashboards, and IPTV and streaming solutions.",
    },
  },
  {
    id: "custom",
    title: { ar: "حلول تقنية حسب الحاجة", en: "Custom tech solutions" },
    body: {
      ar: "نسمع الفكرة، نحدد النطاق، ونبني الحل المناسب إلها.",
      en: "We listen, scope it, and build the solution that fits.",
    },
  },
];
