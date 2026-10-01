import type { Metadata } from "next";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";

import { revokeStaffSessionsAction, setUserRoleAction } from "@/app/admin/actions";
import { RevokeSessions, RoleControl } from "@/app/components/admin/system/SystemClient";
import { SystemHeader } from "@/app/components/admin/system/SystemUI";
import { SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { Badge } from "@/app/ui/Badge";
import { DataTable } from "@/app/ui/DataTable";
import { Select } from "@/app/ui/Field";
import { Pagination } from "@/app/ui/Pagination";
import { EmptyState } from "@/app/ui/States";
import { formatDateTime } from "@/src/lib/i18n";
import { ASSIGNABLE_ROLES, ROLE_LABELS, STAFF_ROLES, hasPermission, isStaffRole } from "@/src/lib/roles";
import { parseStaffQuery } from "@/src/lib/system";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { STAFF_PAGE, findAccountByPhone, listStaff } from "@/src/server/system";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "فريق العمل — النظام" };

/**
 * Staff directory on the existing model (User.role). Role changes and
 * session revocation are the existing server actions, with confirmation.
 * Adding someone = giving an existing account a staff role.
 */
export default async function SystemStaffPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string; phone?: string }> }) {
  const params = await searchParams;
  const { user: me, allowed } = await requireStaffPage("/admin/system/staff", "staff");

  if (!allowed) return <Forbidden />;

  const { t, lang } = await getI18n();
  const query = parseStaffQuery(params);
  const [result, found] = await Promise.all([listStaff(query), params.phone ? findAccountByPhone(params.phone) : Promise.resolve(null)]);
  const labels = Object.fromEntries(Object.entries(ROLE_LABELS).map(([key, value]) => [key, value[lang]]));
  const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(me.role, permission);

  return (
    <div className="space-y-5" data-testid="system-staff">
      <SystemHeader
        active="staff"
        t={t}
        can={can}
        title={t("فريق العمل", "Staff")}
        description={result?.ok ? <span data-testid="staff-count">{t(`${result.data.total} عضو`, `${result.data.total} members`)}</span> : undefined}
      />

      <form role="search" className="glass-soft grid gap-2 rounded-2xl p-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]" data-testid="staff-search-form">
        <label className="relative min-w-0">
          <span className="sr-only">{t("بحث", "Search")}</span>
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" defaultValue={query.q} data-testid="staff-search" placeholder={t("الاسم أو رقم الهاتف", "Name or phone")} className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none" />
        </label>
        <label className="min-w-0">
          <span className="sr-only">{t("الدور", "Role")}</span>
          <Select name="role" defaultValue={query.role} className="py-2 text-sm" data-testid="staff-role-filter">
            <option value="all">{t("كل الأدوار", "All roles")}</option>
            {STAFF_ROLES.map((role) => <option key={role} value={role}>{labels[role]}</option>)}
          </Select>
        </label>
        <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong">{t("بحث", "Search")}</button>
      </form>

      {!result?.ok ? (
        <SectionError label={t("تعذر تحميل فريق العمل.", "Couldn't load staff.")} />
      ) : (
        <>
          <DataTable
            caption={t("فريق العمل", "Staff")}
            rows={result.data.rows}
            rowKey={(row) => row.id}
            empty={<EmptyState title={t("لا يوجد أعضاء مطابقون", "No matching staff")} description={t("جرّب بحثًا أو دورًا آخر.", "Try another search or role.")} />}
            columns={[
              {
                key: "name",
                header: t("العضو", "Member"),
                cell: (row) => (
                  <span className="block min-w-0" data-testid="staff-row" data-user={row.id} data-role={row.role}>
                    <span className="flex flex-wrap items-center gap-2 font-bold text-ink">
                      {row.name}
                      {row.id === me.id ? <Badge tone="glow">{t("أنت", "You")}</Badge> : null}
                      {row.fullAccess ? <Badge tone="warning">{t("صلاحيات كاملة", "Full access")}</Badge> : null}
                    </span>
                    <span className="nums block text-xs text-ink-3" dir="ltr">{row.phone}</span>
                  </span>
                ),
              },
              {
                key: "role",
                header: t("الدور", "Role"),
                cell: (row) =>
                  row.id === me.id ? (
                    <Badge tone="brand">{labels[row.role] ?? row.role}</Badge>
                  ) : (
                    <RoleControl userId={row.id} name={row.name} role={row.role} roles={ASSIGNABLE_ROLES} labels={labels} action={setUserRoleAction} />
                  ),
              },
              {
                key: "activity",
                header: t("النشاط (30 يوم)", "Activity (30 days)"),
                hideOnMobile: true,
                cell: (row) => (
                  <Link href={`/admin/audit?actor=${row.id}`} className="block text-xs hover:text-brand-ink" data-testid="staff-activity">
                    <span className="nums font-semibold text-ink">{row.actions30d}</span> {t("إجراء", "actions")}
                    {row.lastActionAt ? <span className="nums block text-ink-3">{t("آخرها", "last")} {formatDateTime(row.lastActionAt, lang)}</span> : null}
                  </Link>
                ),
              },
              {
                key: "sessions",
                header: t("الجلسات", "Sessions"),
                cell: (row) => (
                  <span className="block space-y-1">
                    <span className="nums block text-xs text-ink-3">{row.sessionsEndedAt ? `${t("آخر إنهاء:", "Last ended:")} ${formatDateTime(row.sessionsEndedAt, lang)}` : t("لم تُنهَ من قبل", "Never ended")}</span>
                    {row.id === me.id ? (
                      <Link href="/admin/security" className="text-xs font-semibold text-brand-ink hover:underline">{t("جلساتك", "Your sessions")}</Link>
                    ) : (
                      <RevokeSessions userId={row.id} name={row.name} action={revokeStaffSessionsAction} />
                    )}
                  </span>
                ),
              },
            ]}
          />
          <Pagination page={query.page} pageCount={Math.max(1, Math.ceil(result.data.total / STAFF_PAGE))} basePath="/admin/system/staff" params={{ q: query.q || undefined, role: query.role !== "all" ? query.role : undefined }} lang={lang} />
        </>
      )}

      <SectionCard title={t("إضافة عضو للفريق", "Add a team member")} icon={<UserPlus size={14} aria-hidden />} testId="staff-add">
        <p className="mb-3 text-sm text-ink-3">{t("الشخص لازم يكون عنده حساب بالموقع. ابحث برقمه ثم اختر الدور.", "The person needs an account on the site. Find it by phone, then pick the role.")}</p>
        <form className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-semibold text-ink-2">{t("رقم الهاتف", "Phone number")}</span>
            <input name="phone" defaultValue={params.phone ?? ""} dir="ltr" inputMode="tel" data-testid="staff-add-phone" className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none" />
          </label>
          <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white">{t("بحث", "Find")}</button>
        </form>
        {params.phone ? (
          found ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-4" data-testid="staff-add-found">
              <p className="font-bold text-ink">
                {found.name} · <span className="text-sm font-normal text-ink-3">{labels[found.role] ?? found.role}</span>
                {isStaffRole(found.role) ? <span className="ms-2 text-xs text-ink-3">({t("عضو بالفريق مسبقًا", "already staff")})</span> : null}
              </p>
              {found.id !== me.id ? <RoleControl userId={found.id} name={found.name} role={found.role} roles={ASSIGNABLE_ROLES} labels={labels} action={setUserRoleAction} /> : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-3" data-testid="staff-add-none">{t("ماكو حساب بهذا الرقم.", "No account with this number.")}</p>
          )
        ) : null}
      </SectionCard>
    </div>
  );
}
