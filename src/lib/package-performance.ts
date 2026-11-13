import { inRange, type Sale } from "@/src/lib/finance";
import type { Range } from "@/src/lib/business-time";

/**
 * Phase 6, step 5 — package performance (pure). See docs/bi/package-performance.md.
 *
 * One row per package AND length (3 months, 1 year…) for completed sales in a
 * range, from the same sales engine as Finance (reward orders are never sales).
 * Profit is computed only on sales whose cost is known: an unknown cost is
 * counted apart («تكلفة غير معروفة») and never treated as zero (CLAUDE.md →
 * Real costs). Revenue is what was charged, already net of discounts.
 * Devices are not packages: a VIP device line is left out of these rows.
 */

export type PackageRow = {
  key: string;
  product: string;
  name: string;
  serviceType: string;
  /** Length in months; null when the sale didn't record it. */
  durationMonths: number | null;
  units: number;
  revenue: number;
  averagePrice: number;
  discount: number;
  discountedUnits: number;
  /** Sales with a known cost, and the money on them. */
  knownCostUnits: number;
  knownCostRevenue: number;
  creditCost: number;
  supplierShare: number;
  /** Revenue − credit cost − supplier share, on known-cost sales only. */
  profit: number;
  /** profit ÷ known-cost revenue, in %; null when no sale has a known cost. */
  marginPct: number | null;
  unknownCostUnits: number;
  unknownCostRevenue: number;
};

const empty = (key: string, product: string, name: string, serviceType: string, durationMonths: number | null): PackageRow => ({
  key,
  product,
  name,
  serviceType,
  durationMonths,
  units: 0,
  revenue: 0,
  averagePrice: 0,
  discount: 0,
  discountedUnits: 0,
  knownCostUnits: 0,
  knownCostRevenue: 0,
  creditCost: 0,
  supplierShare: 0,
  profit: 0,
  marginPct: null,
  unknownCostUnits: 0,
  unknownCostRevenue: 0,
});

const round1 = (value: number) => Math.round(value * 10) / 10;

function finish(row: PackageRow): PackageRow {
  return {
    ...row,
    averagePrice: row.units ? Math.round(row.revenue / row.units) : 0,
    marginPct: row.knownCostRevenue > 0 ? round1((row.profit / row.knownCostRevenue) * 100) : row.knownCostUnits ? 0 : null,
  };
}

/** Package rows (by package and length) for the range, most revenue first, plus their total. */
export function packagePerformance(sales: readonly Sale[], range: Range) {
  const rows = new Map<string, PackageRow>();
  const total = empty("total", "total", "", "", null);

  for (const sale of sales) {
    if (!inRange(sale.at, range)) continue;

    const line = sale.lines.find((item) => item.kind === "package");

    if (!line) continue;

    const months = line.durationMonths ?? null;
    const key = `${line.product}|${months ?? "?"}`;
    const row = rows.get(key) ?? empty(key, line.product, line.name, line.serviceType, months);
    const share = Math.max(0, sale.supplierShareIqd ?? 0);

    for (const target of [row, total]) {
      target.units += 1;
      target.revenue += line.amount;

      if (sale.discountIqd > 0) {
        target.discount += sale.discountIqd;
        target.discountedUnits += 1;
      }

      if (sale.costIqd === null) {
        target.unknownCostUnits += 1;
        target.unknownCostRevenue += line.amount;
      } else {
        target.knownCostUnits += 1;
        target.knownCostRevenue += line.amount;
        target.creditCost += sale.costIqd;
        target.supplierShare += share;
        target.profit += line.amount - sale.costIqd - share;
      }
    }

    rows.set(key, row);
  }

  return {
    rows: [...rows.values()].map(finish).sort((a, b) => b.revenue - a.revenue || b.units - a.units || a.name.localeCompare(b.name) || (a.durationMonths ?? 0) - (b.durationMonths ?? 0)),
    total: finish(total),
  };
}

export type PackagePerformance = ReturnType<typeof packagePerformance>;

/**
 * The row that earned the most profit on known costs — only when it is a
 * clear leader (at least 2 known-cost sales, strictly more profit than the
 * runner-up). Null otherwise: no "best package" from thin or tied data.
 */
export function mostProfitable(rows: readonly PackageRow[]) {
  const ranked = rows.filter((row) => row.knownCostUnits >= 2).sort((a, b) => b.profit - a.profit);
  const [first, second] = ranked;

  if (!first || first.profit <= 0 || (second && second.profit === first.profit)) return null;

  return first;
}
