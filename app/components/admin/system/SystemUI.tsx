import { KeyRound, LayoutGrid, ScrollText, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import type { ReactNode } from "react";

import { LinkTabs } from "@/app/ui/Tabs";
import type { Translate } from "@/src/lib/i18n";
import type { Permission } from "@/src/lib/roles";

/** System / admin building blocks, on the console's existing primitives. */

export type SystemSection = "overview" | "staff" | "roles" | "audit" | "security" | "settings";

export function SystemHeader({ active, t, can, title, description, actions }: { active: SystemSection; t: Translate; can: (permission: Permission) => boolean; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  const tabs = [
    { key: "overview", href: "/admin/system", label: <><LayoutGrid size={14} aria-hidden /> {t("نظرة عامة", "Overview")}</>, show: can("staff") || can("audit") || can("settings") },
    { key: "staff", href: "/admin/system/staff", label: <><UsersRound size={14} aria-hidden /> {t("فريق العمل", "Staff")}</>, show: can("staff") },
    { key: "roles", href: "/admin/system/roles", label: <><KeyRound size={14} aria-hidden /> {t("الأدوار والصلاحيات", "Roles & permissions")}</>, show: can("staff") },
    { key: "audit", href: "/admin/audit", label: <><ScrollText size={14} aria-hidden /> {t("سجل التدقيق", "Audit log")}</>, show: can("audit") },
    { key: "security", href: "/admin/system/security", label: <><ShieldCheck size={14} aria-hidden /> {t("الأمان والجلسات", "Security & sessions")}</>, show: can("staff") },
    { key: "settings", href: "/admin/system/settings", label: <><Settings2 size={14} aria-hidden /> {t("الإعدادات والتهيئة", "Settings & configuration")}</>, show: can("settings") },
  ].filter((tab) => tab.show);

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-ink">
            <ShieldCheck size={14} aria-hidden /> {t("النظام والإدارة", "System & admin")}
          </p>
          <h1 className="mt-2 text-h2 font-bold text-ink">{title}</h1>
          {description ? <p className="mt-1 text-sm text-ink-3">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <LinkTabs label={t("أقسام النظام", "System sections")} active={active} tabs={tabs} />
    </header>
  );
}

export function roleDescriptions(t: Translate): Record<string, string> {
  return {
    OWNER: t("كل الصلاحيات، بما فيها الفريق والإعدادات وسجل التدقيق والمالية.", "Everything, including staff, settings, the audit log and finance."),
    ADMIN: t("حساب مدير سابق — نفس صلاحيات المالك.", "Pre-existing admin account — same access as Owner."),
    OPERATOR: t("الطلبات، الاشتراكات، العملاء، الدعم، والتحليلات.", "Orders, subscriptions, customers, support and insights."),
    SUPPORT: t("الدعم، العملاء، والإشعارات.", "Support, customers and notifications."),
    CONTENT: t("الكتالوج والمحتوى (الإعلانات، الوسائط، حالة الخدمة).", "Catalogue and content (ads, media, service status)."),
  };
}

export function permissionLabels(t: Translate): Record<Permission, string> {
  return {
    orders: t("الطلبات والتفعيل", "Orders & activations"),
    subscriptions: t("الاشتراكات وبيانات الدخول", "Subscriptions & credentials"),
    customers: t("العملاء", "Customers"),
    catalogue: t("الكتالوج", "Catalogue"),
    support: t("الدعم والإشعارات", "Support & notifications"),
    content: t("المحتوى والإعلانات", "Content & ads"),
    insights: t("التحليلات والتقارير", "Insights & reports"),
    finance: t("المالية", "Finance"),
    staff: t("الفريق والأدوار والجلسات", "Staff, roles & sessions"),
    settings: t("الإعدادات", "Settings"),
    audit: t("سجل التدقيق", "Audit log"),
  };
}
