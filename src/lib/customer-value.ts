import { businessDay } from "@/src/lib/business-time";
import type { Sale } from "@/src/lib/finance";

/**
 * Phase 6, step 4 — customer value (pure). See docs/bi/customer-value.md.
 *
 * What each paying customer has ACTUALLY paid, from the same sales engine as
 * Finance (loyalty rewards are never sales). Nothing is projected: no
 * "lifetime value" forecast, no churn guess. Staff accounts are left out
 * (owner and test purchases are not customers).
 *
 * Tiers are relative and explainable: customers ranked by total paid; the
 * top 20% are «الأعلى قيمة», the next 30% «متوسطة», the rest «أساسية».
 */

export type CustomerValueRow = {
  userId: number;
  totalPaid: number;
  purchases: number;
  firstPurchase: string;
  lastPurchase: string;
  /** Whole months from the first purchase to today (0 in the first month). */
  monthsAsCustomer: number;
  activeNow: boolean;
  tier: CustomerTier;
};

export type CustomerTier = "TOP" | "MIDDLE" | "BASE";

export const TIER_SHARES = { TOP: 0.2, MIDDLE: 0.3 } as const;

const monthsBetween = (fromDay: string, toDay: string) => {
  const [fy, fm, fd] = fromDay.split("-").map(Number);
  const [ty, tm, td] = toDay.split("-").map(Number);

  return Math.max(0, (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0));
};

function median(values: number[]) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * Every paying customer's value, plus the summary, tiers and monthly cohorts.
 * `staffIds` are excluded; `activeUserIds` are customers with a subscription
 * running now (active or expiring).
 */
export function customerValue(input: { sales: readonly Sale[]; staffIds: ReadonlySet<number>; activeUserIds: ReadonlySet<number>; today?: string }) {
  const today = input.today ?? businessDay(new Date());
  const byUser = new Map<number, { total: number; purchases: number; first: Date; last: Date }>();

  for (const sale of input.sales) {
    if (input.staffIds.has(sale.userId)) continue;

    const current = byUser.get(sale.userId);

    if (!current) {
      byUser.set(sale.userId, { total: sale.amount, purchases: 1, first: sale.at, last: sale.at });
    } else {
      current.total += sale.amount;
      current.purchases += 1;
      if (sale.at < current.first) current.first = sale.at;
      if (sale.at > current.last) current.last = sale.at;
    }
  }

  const ranked = [...byUser.entries()]
    .map(([userId, value]) => ({ userId, totalPaid: value.total, purchases: value.purchases, firstPurchase: businessDay(value.first), lastPurchase: businessDay(value.last) }))
    .sort((a, b) => b.totalPaid - a.totalPaid || b.purchases - a.purchases || a.firstPurchase.localeCompare(b.firstPurchase) || a.userId - b.userId);

  const count = ranked.length;
  const topCount = count ? Math.max(1, Math.round(count * TIER_SHARES.TOP)) : 0;
  const middleCount = Math.round(count * TIER_SHARES.MIDDLE);

  const rows: CustomerValueRow[] = ranked.map((row, index) => ({
    ...row,
    monthsAsCustomer: monthsBetween(row.firstPurchase, today),
    activeNow: input.activeUserIds.has(row.userId),
    tier: index < topCount ? "TOP" : index < topCount + middleCount ? "MIDDLE" : "BASE",
  }));

  const total = rows.reduce((sum, row) => sum + row.totalPaid, 0);
  const tierOf = (tier: CustomerTier) => {
    const list = rows.filter((row) => row.tier === tier);
    const revenue = list.reduce((sum, row) => sum + row.totalPaid, 0);

    return { customers: list.length, revenue, revenueSharePct: total ? Math.round((revenue / total) * 1000) / 10 : 0, minPaid: list.length ? Math.min(...list.map((row) => row.totalPaid)) : null };
  };

  const cohortMap = new Map<string, { month: string; customers: number; revenue: number; activeNow: number; repeatBuyers: number }>();

  for (const row of rows) {
    const month = row.firstPurchase.slice(0, 7);
    const cohort = cohortMap.get(month) ?? { month, customers: 0, revenue: 0, activeNow: 0, repeatBuyers: 0 };

    cohort.customers += 1;
    cohort.revenue += row.totalPaid;
    if (row.activeNow) cohort.activeNow += 1;
    if (row.purchases > 1) cohort.repeatBuyers += 1;
    cohortMap.set(month, cohort);
  }

  return {
    today,
    summary: {
      payingCustomers: count,
      totalPaid: total,
      averagePaid: count ? Math.round(total / count) : null,
      medianPaid: median(rows.map((row) => row.totalPaid)),
      repeatBuyers: rows.filter((row) => row.purchases > 1).length,
      activeNow: rows.filter((row) => row.activeNow).length,
    },
    tiers: { TOP: tierOf("TOP"), MIDDLE: tierOf("MIDDLE"), BASE: tierOf("BASE") },
    cohorts: [...cohortMap.values()].sort((a, b) => b.month.localeCompare(a.month)),
    rows,
  };
}

export type CustomerValue = ReturnType<typeof customerValue>;
