import { normalizeOrderStatus } from "@/src/lib/order-status";
import { bucketKey, bucketKeys, type Granularity, type Range } from "@/src/lib/business-time";

/**
 * Shashtna financial model — pure functions, unit-tested.
 *
 * REVENUE is money actually received. Payment is manual transfer, verified
 * by staff, so an order counts once it reached PAID / FULFILLING / COMPLETED
 * (legacy ACCEPTED normalises to COMPLETED). Cancelled / rejected orders
 * never count.
 *  - Amount: the receipts issued for the order (activation/renewal can be
 *    issued at a staff-adjusted price), or the order price when no receipt
 *    exists, plus the order's devicePrice. Device-only orders store the
 *    device in both price and devicePrice, so they count once.
 *  - Date: the first time the order was confirmed paid (ORDER_PAID,
 *    ORDER_FULFILLING or ORDER_COMPLETED activity), else its first receipt,
 *    else the order's last update.
 *  - Receipts with no order (issued before orders were linked) count on
 *    their own date.
 * EXPENSES are only what the owner records. NET PROFIT = revenue − expenses,
 * and is reported as incomplete (never as a number) until expenses exist.
 */

export const PAID_STATUSES = ["PAID", "FULFILLING", "COMPLETED"] as const;

export type OrderInput = {
  id: number;
  userId: number;
  status: string;
  requestType: string;
  planSlug: string;
  serviceType: string;
  serviceName: string;
  price: number;
  devicePrice: number | null;
  deviceName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReceiptInput = {
  id: number;
  orderId: number | null;
  userId: number;
  price: number;
  serviceName: string;
  serviceType: string;
  createdAt: string;
};

export type ExpenseInput = { id: number; amount: number; category: string; spentOn: string };

export type SaleLine = {
  /** Stable product key: "package:<slug>" or "device:<name>". */
  product: string;
  name: string;
  kind: "package" | "device";
  serviceType: string;
  amount: number;
};

export type Sale = {
  key: string;
  orderId: number | null;
  userId: number;
  at: Date;
  amount: number;
  requestType: string;
  lines: SaleLine[];
};

export function parseInstant(value: string | null | undefined) {
  if (!value) return null;
  const raw = String(value).trim();
  // A bare business date ("2026-09-05") is Baghdad midnight; check it before
  // normalising offsets, or its "-05" would be read as a timezone.
  const text = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00+03:00` : raw.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(text);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function isPaidStatus(status: unknown) {
  return (PAID_STATUSES as readonly string[]).includes(normalizeOrderStatus(status));
}

/** Turn orders, receipts and payment-confirmation times into recognised sales. */
export function recognizeSales(input: {
  orders: OrderInput[];
  receipts: ReceiptInput[];
  /** orderId → ISO time the order was first confirmed paid. */
  paidAt: Map<number, string>;
  /** planSlug → current package name (falls back to the order's name). */
  packageNames?: Map<string, string>;
}): Sale[] {
  const receiptsByOrder = new Map<number, ReceiptInput[]>();

  for (const receipt of input.receipts) {
    if (receipt.orderId) {
      const list = receiptsByOrder.get(receipt.orderId) ?? [];
      list.push(receipt);
      receiptsByOrder.set(receipt.orderId, list);
    }
  }

  const orderIds = new Set(input.orders.map((order) => order.id));
  const sales: Sale[] = [];

  for (const order of input.orders) {
    if (!isPaidStatus(order.status)) continue;

    const receipts = receiptsByOrder.get(order.id) ?? [];
    const firstReceipt = receipts
      .map((receipt) => parseInstant(receipt.createdAt))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const at = parseInstant(input.paidAt.get(order.id)) ?? firstReceipt ?? parseInstant(order.updatedAt) ?? parseInstant(order.createdAt);

    if (!at) continue;

    const lines: SaleLine[] = [];
    const requestType = String(order.requestType ?? "NEW").toUpperCase();

    if (requestType === "DEVICE_PURCHASE") {
      const name = order.deviceName || order.serviceName;
      lines.push({ product: `device:${name}`, name, kind: "device", serviceType: "DEVICE", amount: Math.max(0, order.price) });
    } else {
      const packageAmount = receipts.length ? receipts.reduce((sum, receipt) => sum + receipt.price, 0) : order.price;
      const name = input.packageNames?.get(order.planSlug) ?? order.serviceName;
      lines.push({ product: `package:${order.planSlug || name}`, name, kind: "package", serviceType: String(order.serviceType).toUpperCase(), amount: Math.max(0, packageAmount) });

      if (order.devicePrice && order.devicePrice > 0) {
        const deviceName = order.deviceName || "Device";
        lines.push({ product: `device:${deviceName}`, name: deviceName, kind: "device", serviceType: "DEVICE", amount: order.devicePrice });
      }
    }

    sales.push({ key: `order:${order.id}`, orderId: order.id, userId: order.userId, at, amount: lines.reduce((sum, line) => sum + line.amount, 0), requestType, lines });
  }

  // Receipts that were never linked to an order (or whose order is gone).
  for (const receipt of input.receipts) {
    if (receipt.orderId && orderIds.has(receipt.orderId)) continue;

    const at = parseInstant(receipt.createdAt);
    if (!at) continue;

    sales.push({
      key: `receipt:${receipt.id}`,
      orderId: null,
      userId: receipt.userId,
      at,
      amount: receipt.price,
      requestType: "UNKNOWN",
      lines: [{ product: `package:${receipt.serviceName}`, name: receipt.serviceName, kind: "package", serviceType: String(receipt.serviceType).toUpperCase(), amount: receipt.price }],
    });
  }

  return sales.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function inRange(date: Date | null, range: Range) {
  return Boolean(date) && date!.getTime() >= range.start.getTime() && date!.getTime() < range.end.getTime();
}

export function sumSales(sales: Sale[], range: Range) {
  let amount = 0;
  let count = 0;

  for (const sale of sales) {
    if (inRange(sale.at, range)) {
      amount += sale.amount;
      count += 1;
    }
  }

  return { amount, count };
}

export function sumExpenses(expenses: ExpenseInput[], range: Range, category?: string) {
  return expenses.reduce((sum, expense) => {
    const at = parseInstant(expense.spentOn);

    return inRange(at, range) && (!category || expense.category === category) ? sum + expense.amount : sum;
  }, 0);
}

/** Percentage change, or null when there is no base to compare with. */
export function percentChange(current: number, previous: number) {
  if (!previous) return null;

  return ((current - previous) / previous) * 100;
}

export type ProfitState = { status: "ok"; amount: number } | { status: "incomplete"; reason: "NO_EXPENSES_RECORDED" };

/**
 * Net profit is only a number once the owner has started recording
 * expenses at all; before that it is "data incomplete", never revenue.
 */
export function netProfit(revenue: number, expenses: number, anyExpenseRecorded: boolean): ProfitState {
  return anyExpenseRecorded ? { status: "ok", amount: revenue - expenses } : { status: "incomplete", reason: "NO_EXPENSES_RECORDED" };
}

export type TrendPoint = { key: string; revenue: number; expenses: number; profit: number; sales: number };

export function trendSeries(sales: Sale[], expenses: ExpenseInput[], range: Range, granularity: Granularity): TrendPoint[] {
  const points = new Map<string, TrendPoint>(bucketKeys(range, granularity).map((key) => [key, { key, revenue: 0, expenses: 0, profit: 0, sales: 0 }]));

  for (const sale of sales) {
    if (!inRange(sale.at, range)) continue;
    const point = points.get(bucketKey(sale.at, granularity));
    if (point) {
      point.revenue += sale.amount;
      point.sales += 1;
    }
  }

  for (const expense of expenses) {
    const at = parseInstant(expense.spentOn);
    if (!at || !inRange(at, range)) continue;
    const point = points.get(bucketKey(at, granularity));
    if (point) point.expenses += expense.amount;
  }

  for (const point of points.values()) point.profit = point.revenue - point.expenses;

  return [...points.values()];
}

export type ProductRow = {
  product: string;
  name: string;
  kind: "package" | "device";
  serviceType: string;
  units: number;
  revenue: number;
  share: number;
  averageOrderValue: number;
};

/** Units and revenue per product for completed sales in the range. */
export function productPerformance(sales: Sale[], range: Range): ProductRow[] {
  const rows = new Map<string, ProductRow>();
  let total = 0;

  for (const sale of sales) {
    if (!inRange(sale.at, range)) continue;

    for (const line of sale.lines) {
      const row = rows.get(line.product) ?? { product: line.product, name: line.name, kind: line.kind, serviceType: line.serviceType, units: 0, revenue: 0, share: 0, averageOrderValue: 0 };
      row.units += 1;
      row.revenue += line.amount;
      total += line.amount;
      rows.set(line.product, row);
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, share: total ? (row.revenue / total) * 100 : 0, averageOrderValue: row.units ? row.revenue / row.units : 0 }))
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units);
}

/**
 * The most sold product by completed purchases. Returns null unless there
 * is a clear leader: at least `minimum` sales and strictly more units than
 * the runner-up (a tie is not a "most sold").
 */
export function mostSold(rows: ProductRow[], minimum = 2) {
  const byUnits = [...rows].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
  const [first, second] = byUnits;

  if (!first || first.units < minimum || (second && second.units === first.units)) return null;

  return first;
}

/** Revenue split into the top products plus "other". */
export function revenueBreakdown(rows: ProductRow[], top = 4) {
  const leaders = rows.slice(0, top).map((row) => ({ label: row.name, revenue: row.revenue, share: row.share }));
  const rest = rows.slice(top);

  if (rest.length) {
    const revenue = rest.reduce((sum, row) => sum + row.revenue, 0);
    leaders.push({ label: "OTHER", revenue, share: rest.reduce((sum, row) => sum + row.share, 0) });
  }

  return leaders;
}
