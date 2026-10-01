import type { Permission } from "@/src/lib/roles";

export type AdminNavItem = {
  href: string;
  ar: string;
  en: string;
  icon: string;
  /** Omitted = every staff role (e.g. the Console Home). */
  permission?: Permission;
  /** Visible when the role holds ANY of these (e.g. the Operations Center). */
  anyOf?: Permission[];
  badgeKey?: "orders" | "activations" | "renewals" | "tickets" | "resets" | "leads";
};

export type AdminNavGroup = { ar: string; en: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    ar: "العمليات",
    en: "Operations",
    items: [
      { href: "/admin", ar: "الرئيسية", en: "Home", icon: "home" },
      { href: "/admin/operations", ar: "مركز العمليات", en: "Operations Center", icon: "operations", anyOf: ["orders", "subscriptions", "support"] },
      { href: "/admin/orders", ar: "الطلبات", en: "Orders", icon: "orders", permission: "orders", badgeKey: "orders" },
      { href: "/admin/activations", ar: "التفعيل", en: "Activations", icon: "activations", permission: "orders", badgeKey: "activations" },
      { href: "/admin/renewals", ar: "التجديدات المستحقة", en: "Renewals due", icon: "renewals", permission: "subscriptions", badgeKey: "renewals" },
    ],
  },
  {
    ar: "العملاء",
    en: "Customers",
    items: [
      { href: "/admin/customers", ar: "العملاء", en: "Customers", icon: "customers", permission: "customers" },
      { href: "/admin/subscriptions", ar: "الاشتراكات", en: "Subscriptions", icon: "subscriptions", permission: "subscriptions" },
      { href: "/admin/lookup", ar: "بحث سريع", en: "Lookup", icon: "lookup", permission: "subscriptions" },
      { href: "/admin/password-resets", ar: "إعادة تعيين كلمات المرور", en: "Password resets", icon: "resets", permission: "customers", badgeKey: "resets" },
    ],
  },
  {
    ar: "الكتالوج",
    en: "Catalogue",
    items: [
      { href: "/admin/packages", ar: "الباقات", en: "Packages", icon: "packages", permission: "catalogue" },
      { href: "/admin/devices", ar: "الأجهزة", en: "Devices", icon: "devices", permission: "catalogue" },
      { href: "/admin/apps", ar: "التطبيقات", en: "Apps", icon: "apps", permission: "catalogue" },
    ],
  },
  {
    ar: "التفاعل",
    en: "Engagement",
    items: [
      { href: "/admin/support", ar: "تذاكر الدعم", en: "Tickets", icon: "tickets", permission: "support", badgeKey: "tickets" },
      { href: "/admin/announcements", ar: "الإعلانات", en: "Ads & announcements", icon: "announcements", permission: "content" },
      { href: "/admin/notifications", ar: "الإشعارات", en: "Notifications", icon: "notifications", permission: "support" },
      { href: "/admin/status", ar: "حالة الخدمة", en: "Service status", icon: "status", permission: "content" },
      { href: "/admin/leads", ar: "طلبات الحلول الرقمية", en: "Digital leads", icon: "leads", permission: "orders", badgeKey: "leads" },
    ],
  },
  {
    ar: "التحليلات",
    en: "Insights",
    items: [
      { href: "/admin/insights", ar: "لوحة المؤشرات", en: "Dashboard", icon: "insights", permission: "insights" },
      { href: "/admin/finance", ar: "المالية والأداء", en: "Finance & BI", icon: "finance", permission: "finance" },
      { href: "/admin/revenue", ar: "الإيرادات", en: "Revenue", icon: "revenue", permission: "insights" },
      { href: "/admin/reports", ar: "التقارير", en: "Reports", icon: "reports", permission: "insights" },
    ],
  },
  {
    ar: "النظام",
    en: "System",
    items: [
      { href: "/admin/admins", ar: "المشرفون والصلاحيات", en: "Admins & roles", icon: "admins", permission: "staff" },
      { href: "/admin/audit", ar: "سجل التدقيق", en: "Audit log", icon: "audit", permission: "audit" },
      { href: "/admin/settings", ar: "الإعدادات", en: "Settings", icon: "settings", permission: "settings" },
    ],
  },
];

/**
 * Primary destinations for the compact layouts (tablet rail, mobile bottom
 * bar), in priority order. Each user sees the first ones their role can
 * open (see `primaryItems`); everything else stays one tap away in "More".
 */
export const PRIMARY_DESTINATIONS: { href: string; ar: string; en: string }[] = [
  { href: "/admin", ar: "الرئيسية", en: "Home" },
  { href: "/admin/operations", ar: "العمليات", en: "Operations" },
  { href: "/admin/orders", ar: "الطلبات", en: "Orders" },
  { href: "/admin/customers", ar: "العملاء", en: "Customers" },
  { href: "/admin/finance", ar: "المالية", en: "Finance" },
  { href: "/admin/subscriptions", ar: "الاشتراكات", en: "Subscriptions" },
  { href: "/admin/support", ar: "الدعم", en: "Support" },
  { href: "/admin/packages", ar: "الباقات", en: "Packages" },
  { href: "/admin/announcements", ar: "الإعلانات", en: "Ads" },
];

export function primaryItems(groups: AdminNavGroup[], limit: number) {
  const allowed = new Map(groups.flatMap((group) => group.items).map((item) => [item.href, item]));

  return PRIMARY_DESTINATIONS.flatMap((destination) => {
    const item = allowed.get(destination.href);

    return item ? [{ ...item, short: { ar: destination.ar, en: destination.en } }] : [];
  }).slice(0, limit);
}
