import { ADMIN_NAV } from "@/app/components/admin/nav";
import { BUSINESS_TIME_ZONE } from "@/src/lib/business-time";
import type { SummaryCountKey } from "@/src/lib/console-api";
import { loadSection } from "@/src/lib/dashboard-section";
import { hasPermission, type Permission } from "@/src/lib/roles";
import { getQueueCounts } from "@/src/server/admin-queues";
import { consoleJson, consoleRoute, requireConsoleStaff } from "@/src/server/console-api";
import { proofsAwaitingReview } from "@/src/server/dashboard";
import { getFinanceSnapshot } from "@/src/server/finance";

/**
 * Which permission each count needs: exactly the permission of the console
 * nav item that shows that badge (ADMIN_NAV), so the shell and the web
 * console can never disagree. Payment proofs follow the Console Home rule
 * (orders).
 */
function countPermissions(): Record<SummaryCountKey, Permission> {
  const fromNav = Object.fromEntries(
    ADMIN_NAV.flatMap((group) => group.items).flatMap((item) => (item.badgeKey && item.permission ? [[item.badgeKey, item.permission]] : [])),
  ) as Partial<Record<SummaryCountKey, Permission>>;

  return { orders: "orders", activations: "orders", renewals: "subscriptions", resets: "customers", leads: "orders", tickets: "support", ...fromNav, proofs: "orders" };
}

/**
 * GET /api/console/v1/summary — the native shell's home: attention counts
 * from the same server functions as the console badges and Console Home,
 * and the month's money headline only for roles with "finance" (never
 * computed for anyone else). A count the role may not see is omitted; a
 * source that failed is listed in `unavailable`, never sent as 0.
 */
export const GET = consoleRoute(async (request: Request) => {
  const auth = await requireConsoleStaff(request);
  if (!auth.ok) return auth.response;

  const can = (permission: Permission) => hasPermission(auth.user.role, permission);
  const permissions = countPermissions();
  const queueKeys = (["orders", "activations", "renewals", "resets", "leads", "tickets"] as const).filter((key) => can(permissions[key]));

  const [queues, proofs, finance] = await Promise.all([
    loadSection(queueKeys.length > 0, "CONSOLE_QUEUES", () => getQueueCounts()),
    loadSection(can(permissions.proofs), "CONSOLE_PROOFS", proofsAwaitingReview),
    loadSection(can("finance"), "CONSOLE_FINANCE", () => getFinanceSnapshot({ period: "month", view: "day", from: null, to: null })),
  ]);

  const counts: Partial<Record<SummaryCountKey, number>> = {};
  const unavailable: string[] = [];

  if (queues?.ok) for (const key of queueKeys) counts[key] = queues.data[key];
  else if (queues) unavailable.push(...queueKeys);

  if (proofs?.ok) counts.proofs = proofs.data;
  else if (proofs) unavailable.push("proofs");

  const body: Record<string, unknown> = { ok: true, generatedAt: new Date().toISOString(), timeZone: BUSINESS_TIME_ZONE, counts };

  if (finance?.ok) {
    const snapshot = finance.data;
    body.finance = {
      currency: "IQD",
      period: "month",
      revenue: snapshot.revenue.amount,
      sales: snapshot.revenue.sales,
      previous: snapshot.revenue.previous,
      changePct: snapshot.revenue.change === null ? null : Math.round(snapshot.revenue.change * 10) / 10,
      netProfit: snapshot.profit.status === "ok" ? { status: "ok", amount: snapshot.profit.amount } : { status: "incomplete" },
    };
  } else if (finance) {
    unavailable.push("finance");
  }

  body.unavailable = unavailable;

  return consoleJson(body);
});
