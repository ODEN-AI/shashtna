import { NextResponse } from "next/server";

import { normalizeOrderStatus, UNPAID_STORED_STATUSES } from "@/src/lib/order-status";
import { hasPermission, isStaffRole, normalizeRole } from "@/src/lib/roles";
import { requireAdmin } from "@/src/lib/session";
import { deriveSubscriptionState } from "@/src/lib/subscription-state";
import { db } from "@/src/prisma/db";
import { getFinanceSnapshot } from "@/src/server/finance";

/**
 * GET /api/admin/stats — summary counts for staff with "insights".
 *
 * The response's shape depends on permission: operational counts for every
 * "insights" role, plus a `finance` block ONLY for roles holding "finance".
 * Money is never computed for anyone else (not computed-then-hidden), and it
 * comes from the Finance engine (getFinanceSnapshot), the single source of
 * revenue/profit — not a second calculation from receipts. Values the system
 * doesn't record (live connections, debts) are not returned at all.
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request, "insights");

    if (!admin.ok) {
      return admin.response;
    }

    const [roles, subscriptions, packages, apps, orders] = await Promise.all([
      db.orm.public.User.groupBy("role").aggregate((a) => ({ n: a.count() })),
      db.orm.public.Subscription.select("status", "expiryDate").all(),
      db.orm.public.Package.groupBy("isActive").aggregate((a) => ({ n: a.count() })),
      db.orm.public.App.groupBy("isActive").aggregate((a) => ({ n: a.count() })),
      db.orm.public.SubscriptionRequest.groupBy("status").aggregate((a) => ({ n: a.count() })),
    ]);

    const states = subscriptions.map((row) => deriveSubscriptionState({ status: row.status, expiryDate: String(row.expiryDate) }));
    const ordersIn = (statuses: readonly string[]) => orders.filter((row) => statuses.includes(normalizeOrderStatus(row.status))).reduce((sum, row) => sum + Number(row.n), 0);
    const total = (rows: { n: number }[]) => rows.reduce((sum, row) => sum + Number(row.n), 0);
    const active = (rows: { isActive: boolean; n: number }[]) => Number(rows.find((row) => row.isActive)?.n ?? 0);

    const stats = {
      totalUsers: total(roles),
      totalCustomers: roles.filter((row) => !isStaffRole(normalizeRole(row.role))).reduce((sum, row) => sum + Number(row.n), 0),
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: states.filter((state) => state === "ACTIVE" || state === "EXPIRING").length,
      expiredSubscriptions: states.filter((state) => state === "EXPIRED").length,
      totalPackages: total(packages),
      activePackages: active(packages),
      totalApps: total(apps),
      activeApps: active(apps),
      totalRequests: total(orders),
      pendingRequests: ordersIn(UNPAID_STORED_STATUSES.map((status) => normalizeOrderStatus(status))),
      acceptedRequests: ordersIn(["COMPLETED"]),
      rejectedRequests: ordersIn(["REJECTED"]),
    };

    const body: Record<string, unknown> = { success: true, stats, ...stats };

    if (hasPermission(admin.user.role, "finance")) {
      const snapshot = await getFinanceSnapshot({ period: "month", view: "day", from: null, to: null });
      const today = snapshot.quick.find((item) => item.key === "today");

      body.finance = {
        currency: "IQD",
        month: { revenue: snapshot.revenue.amount, sales: snapshot.revenue.sales, expenses: snapshot.expenses.recorded ? snapshot.expenses.amount : null },
        today: { revenue: today?.revenue ?? 0, sales: today?.sales ?? 0 },
        // "incomplete" (no amount) until expenses are recorded — revenue is not profit.
        netProfit: snapshot.profit.status === "ok" ? { status: "ok", amount: snapshot.profit.amount } : { status: "incomplete" },
      };
    }

    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ADMIN_STATS_ERROR:", error instanceof Error ? error.message : error);

    return NextResponse.json({ success: false, message: "تعذر تحميل الإحصائيات." }, { status: 500 });
  }
}
