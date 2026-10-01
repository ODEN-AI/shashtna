import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";

import { SystemHeader, permissionLabels, roleDescriptions } from "@/app/components/admin/system/SystemUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { cn } from "@/app/ui/cn";
import { PERMISSIONS, ROLE_LABELS, hasPermission } from "@/src/lib/roles";
import { roleMatrix } from "@/src/lib/system";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الأدوار والصلاحيات — النظام" };

/**
 * The role model as the server enforces it (src/lib/roles.ts). Roles are
 * fixed in code; this page shows exactly what each one can do — it's the
 * same hasPermission() every page and API calls.
 */
export default async function SystemRolesPage() {
  const { user, allowed } = await requireStaffPage("/admin/system/roles", "staff");

  if (!allowed) return <Forbidden />;

  const { t, lang } = await getI18n();
  const matrix = roleMatrix();
  const permissions = permissionLabels(t);
  const descriptions = roleDescriptions(t);

  return (
    <div className="space-y-5" data-testid="system-roles-page">
      <SystemHeader active="roles" t={t} can={(permission) => hasPermission(user.role, permission)} title={t("الأدوار والصلاحيات", "Roles & permissions")} description={t("الأدوار ثابتة بالنظام وتُفحص على الخادم بكل طلب. تغيير دور شخص يتم من «فريق العمل».", "Roles are fixed in the system and checked on the server on every request. Change someone's role from Staff.")} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {matrix.map((row) => (
          <article key={row.role} className="rounded-2xl border border-line bg-surface/70 p-4" data-testid="role-card" data-role={row.role}>
            <h2 className="font-bold text-ink">{ROLE_LABELS[row.role]?.[lang] ?? row.role}</h2>
            <p className="mt-1 text-sm text-ink-2">{descriptions[row.role]}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {PERMISSIONS.filter((permission) => row.permissions[permission]).map((permission) => (
                <li key={permission} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2" data-testid="role-permission" data-permission={permission}>{permissions[permission]}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line" data-testid="role-matrix">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">{t("مصفوفة الصلاحيات", "Permission matrix")}</caption>
          <thead className="bg-surface-2 text-xs text-ink-3">
            <tr>
              <th scope="col" className="px-3 py-2 text-start">{t("الصلاحية", "Permission")}</th>
              {matrix.map((row) => <th key={row.role} scope="col" className="px-3 py-2 text-center">{ROLE_LABELS[row.role]?.[lang] ?? row.role}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {PERMISSIONS.map((permission) => (
              <tr key={permission}>
                <th scope="row" className="px-3 py-2 text-start font-semibold text-ink">{permissions[permission]}</th>
                {matrix.map((row) => (
                  <td key={row.role} className={cn("px-3 py-2 text-center", row.permissions[permission] ? "text-success" : "text-ink-3")}>
                    {row.permissions[permission] ? <Check size={15} className="inline" aria-label={t("مسموح", "Allowed")} /> : <Minus size={15} className="inline" aria-label={t("غير مسموح", "Not allowed")} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-3">{t("الجدول يمرَّر أفقيًا على الشاشات الصغيرة؛ البطاقات أعلاه تعرض نفس المعلومة.", "The table scrolls sideways on small screens; the cards above show the same information.")}</p>
    </div>
  );
}
