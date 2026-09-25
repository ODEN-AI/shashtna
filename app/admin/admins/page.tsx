import type { Metadata } from "next";

import { setUserRoleAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge } from "@/app/ui/Badge";
import { Card, CardHeader } from "@/app/ui/Card";
import { Field, Input, Select } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { ASSIGNABLE_ROLES, ROLE_LABELS, isStaffRole } from "@/src/lib/roles";
import { db } from "@/src/prisma/db";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المشرفون والصلاحيات" };

export default async function AdminsPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { phone } = await searchParams;
  const { user: me, allowed } = await requireStaffPage("/admin/admins", "staff");

  if (!allowed) {
    return <Forbidden />;
  }

  const { t, lang } = await getI18n();
  const users = await db.orm.public.User.orderBy((user) => user.id.asc()).all();
  const staff = users.filter((user) => isStaffRole(user.role));
  const found = phone ? users.find((user) => user.phone === phone.trim()) : undefined;

  const descriptions: Record<string, { ar: string; en: string }> = {
    OWNER: { ar: "كل الصلاحيات، بما فيها الفريق والإعدادات وسجل التدقيق.", en: "Everything, including staff, settings and the audit log." },
    ADMIN: { ar: "حساب مدير سابق — نفس صلاحيات المالك.", en: "Pre-existing admin account — same access as Owner." },
    OPERATOR: { ar: "الطلبات، الاشتراكات، العملاء، الدعم، والتحليلات.", en: "Orders, subscriptions, customers, support and insights." },
    SUPPORT: { ar: "تذاكر الدعم، العملاء، الإشعارات، وإعادة تعيين كلمات المرور.", en: "Tickets, customers, notifications and password resets." },
    CONTENT: { ar: "الكتالوج (الباقات، الأجهزة، التطبيقات)، الإعلانات، وحالة الخدمة.", en: "Catalogue (packages, devices, apps), announcements and service status." },
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("المشرفون والصلاحيات", "Admins & roles")} description={t("الصلاحيات تُفحص على الخادم بكل طلب.", "Permissions are checked on the server on every request.")} />

      <Card className="p-6">
        <CardHeader title={t("الأدوار", "Roles")} />
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.entries(descriptions).map(([role, description]) => (
            <div key={role} className="rounded-2xl border border-line bg-surface-2 p-4">
              <dt className="font-bold text-ink">{ROLE_LABELS[role][lang]}</dt>
              <dd className="mt-1 text-sm text-ink-2">{description[lang]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-6">
        <CardHeader title={t("فريق العمل", "Staff")} />
        <ul className="mt-4 divide-y divide-line">
          {staff.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-bold text-ink">
                  {user.name} {user.id === me.id ? <Badge tone="glow">{t("أنت", "You")}</Badge> : null}
                </p>
                <p className="nums text-xs text-ink-3" dir="ltr">{user.phone}</p>
              </div>
              {user.id === me.id ? <Badge tone="brand">{ROLE_LABELS[user.role]?.[lang] ?? user.role}</Badge> : <RoleForm userId={user.id} role={user.role} lang={lang} />}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6">
        <CardHeader title={t("إضافة عضو للفريق", "Add a team member")} description={t("الشخص لازم يكون عنده حساب بالموقع أولًا.", "The person needs an account on the site first.")} />
        <form className="mt-4 flex flex-wrap items-end gap-2">
          <Field label={t("رقم الهاتف", "Phone number")} htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={phone ?? ""} dir="ltr" className="h-10 py-0 text-start" />
          </Field>
          <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-white">{t("بحث", "Find")}</button>
        </form>
        {phone ? (
          found ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-4">
              <p className="font-bold text-ink">{found.name} · <span className="text-sm font-normal text-ink-3">{ROLE_LABELS[found.role]?.[lang] ?? found.role}</span></p>
              {found.id !== me.id ? <RoleForm userId={found.id} role={found.role} lang={lang} /> : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-3">{t("ماكو حساب بهذا الرقم.", "No account with this number.")}</p>
          )
        ) : null}
      </Card>
    </div>
  );
}

function RoleForm({ userId, role, lang }: { userId: number; role: string; lang: "ar" | "en" }) {
  return (
    <ActionForm action={setUserRoleAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Select name="role" defaultValue={role === "ADMIN" ? "OWNER" : role} className="h-9 w-auto py-0 text-sm" aria-label={lang === "ar" ? "الدور" : "Role"}>
        {ASSIGNABLE_ROLES.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABELS[value][lang]}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" variant="secondary">
        {lang === "ar" ? "تحديث" : "Update"}
      </SubmitButton>
    </ActionForm>
  );
}
