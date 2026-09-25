import type { Metadata } from "next";

import { AdminShell } from "@/app/components/admin/AdminShell";
import { ADMIN_NAV } from "@/app/components/admin/nav";
import { ROLE_LABELS, hasPermission } from "@/src/lib/roles";
import { getQueueCounts } from "@/src/server/admin-queues";
import { requireStaffPage } from "@/src/server/auth";
import { getLang } from "@/src/server/i18n";

export const metadata: Metadata = {
  title: { default: "لوحة الإدارة", template: "%s | إدارة شاشتنا" },
  robots: { index: false, follow: false },
};

// Server-side gate for every /admin page: staff only. Each admin API also
// re-checks the role and the specific permission on every request.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, lang] = await Promise.all([requireStaffPage("/admin"), getLang()]);
  const counts = await getQueueCounts().catch(() => ({}));

  const groups = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(user.role, item.permission)),
  })).filter((group) => group.items.length);

  return (
    <AdminShell groups={groups} counts={counts} user={{ name: user.name }} roleLabel={ROLE_LABELS[user.role]?.[lang] ?? user.role}>
      {children}
    </AdminShell>
  );
}
