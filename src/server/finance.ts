import { cache } from "react";

import { businessDay, resolveRange, trendRange, type Granularity, type PeriodKey, type Range } from "@/src/lib/business-time";
import {
  inRange,
  isPaidStatus,
  mostSold,
  netProfit,
  parseInstant,
  percentChange,
  productPerformance,
  recognizeSales,
  revenueBreakdown,
  sumExpenses,
  sumSales,
  trendSeries,
  type ExpenseInput,
  type Sale,
} from "@/src/lib/finance";
import { normalizeOrderStatus } from "@/src/lib/order-status";
import { isStaffRole } from "@/src/lib/roles";
import { deriveSubscriptionState } from "@/src/lib/subscription-state";
import { db } from "@/src/prisma/db";
import { proofUploadTimes } from "@/src/server/payment-proofs";

/**
 * Financial & business-intelligence data for Admin → Finance. Read-only over
 * the existing orders / receipts / activity / subscriptions / users, plus
 * the owner-recorded expenses. Everything is aggregated on the server in one
 * pass per request; no figure here is estimated or invented, and anything
 * the system does not collect is listed in `dataGaps`.
 */

export const EXPENSE_CATEGORIES = ["HOSTING", "SERVERS", "DOMAINS", "SOFTWARE", "ADVERTISING", "MARKETING", "OPERATIONS", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const PAID_ACTIONS = ["ORDER_PAID", "ORDER_FULFILLING", "ORDER_COMPLETED"];

/** One load of every source table the finance views need (deduped per request). */
export const loadFinanceSources = cache(async () => {
  const [orders, receipts, events, expenses, packages, users, subscriptions] = await Promise.all([
    db.orm.public.SubscriptionRequest.select(
      "id",
      "userId",
      "status",
      "requestType",
      "planSlug",
      "serviceType",
      "serviceName",
      "price",
      "devicePrice",
      "deviceName",
      "createdAt",
      "updatedAt",
    ).all(),
    db.orm.public.Receipt.select("id", "orderId", "userId", "price", "serviceName", "serviceType", "createdAt").all(),
    db.orm.public.ActivityEvent.where({ entityType: "ORDER" })
      .where((item) => item.action.in(PAID_ACTIONS))
      .select("entityId", "createdAt")
      .all(),
    db.orm.public.Expense.select("id", "amount", "category", "spentOn", "description", "reference", "createdAt").all(),
    db.orm.public.Package.select("slug", "name").all(),
    db.orm.public.User.select("id", "role", "createdAt").all(),
    db.orm.public.Subscription.select("status", "expiryDate", "userId").all(),
  ]);

  // First confirmed-paid moment per order.
  const paidAt = new Map<number, string>();
  for (const event of events) {
    const id = Number(event.entityId);
    if (!Number.isInteger(id)) continue;
    const at = String(event.createdAt);
    const current = paidAt.get(id);
    if (!current || (parseInstant(at)?.getTime() ?? 0) < (parseInstant(current)?.getTime() ?? 0)) paidAt.set(id, at);
  }

  const normalizedOrders = orders.map((order) => ({ ...order, createdAt: String(order.createdAt), updatedAt: String(order.updatedAt) }));
  const sales = recognizeSales({
    orders: normalizedOrders,
    receipts: receipts.map((receipt) => ({ ...receipt, createdAt: String(receipt.createdAt) })),
    paidAt,
    packageNames: new Map(packages.map((pkg) => [pkg.slug, pkg.name])),
  });
  const expenseRows: (ExpenseInput & { description: string; reference: string | null; createdAt: string })[] = expenses.map((expense) => ({
    ...expense,
    spentOn: String(expense.spentOn),
    createdAt: String(expense.createdAt),
  }));

  return { orders: normalizedOrders, sales, expenses: expenseRows, users, subscriptions };
});

type Sources = Awaited<ReturnType<typeof loadFinanceSources>>;

export type PeriodSelection = { period: PeriodKey; from?: string | null; to?: string | null; view: Granularity };

export function parseSelection(params: { period?: string; from?: string; to?: string; view?: string }): PeriodSelection {
  const period = (["today", "week", "month", "year", "custom"] as const).find((value) => value === params.period) ?? "month";
  const view = (["day", "week", "month", "year"] as const).find((value) => value === params.view) ?? "day";

  return { period, from: params.from ?? null, to: params.to ?? null, view };
}

function orderStats(sources: Sources, range: Range, sales: Sale[]) {
  const created = sources.orders.filter((order) => inRange(parseInstant(order.createdAt), range));
  const byStatus = (statuses: string[]) => created.filter((order) => statuses.includes(normalizeOrderStatus(order.status))).length;
  const paidSales = sales.filter((sale) => sale.orderId && inRange(sale.at, range));

  return {
    created: created.length,
    completed: paidSales.length,
    cancelled: byStatus(["CANCELLED"]),
    rejected: byStatus(["REJECTED"]),
    pending: byStatus(["SUBMITTED", "AWAITING_PAYMENT"]),
    inProgress: byStatus(["PAID", "FULFILLING"]),
    // Of the orders created in the period, the share that has been paid.
    conversion: created.length ? (created.filter((order) => isPaidStatus(order.status)).length / created.length) * 100 : null,
  };
}

function customerStats(sources: Sources, range: Range, sales: Sale[]) {
  const customers = sources.users.filter((user) => !isStaffRole(user.role));
  const newCustomers = customers.filter((user) => inRange(parseInstant(String(user.createdAt)), range)).length;
  const inPeriod = sales.filter((sale) => inRange(sale.at, range));
  const payers = new Set(inPeriod.map((sale) => sale.userId));
  const earlierPayers = new Set(sales.filter((sale) => sale.at.getTime() < range.start.getTime()).map((sale) => sale.userId));
  const returning = [...payers].filter((id) => earlierPayers.has(id)).length;
  const states = sources.subscriptions.map((subscription) => deriveSubscriptionState({ status: subscription.status, expiryDate: String(subscription.expiryDate) }));
  const lifetimePayers = new Set(sales.map((sale) => sale.userId));
  const lifetimeRevenue = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const revenue = inPeriod.reduce((sum, sale) => sum + sale.amount, 0);

  return {
    newCustomers,
    payingCustomers: payers.size,
    returningCustomers: returning,
    firstTimeCustomers: payers.size - returning,
    activeSubscribers: states.filter((state) => state === "ACTIVE" || state === "EXPIRING").length,
    expiringSubscriptions: states.filter((state) => state === "EXPIRING").length,
    renewals: inPeriod.filter((sale) => sale.requestType === "RENEW").length,
    revenuePerCustomer: payers.size ? revenue / payers.size : null,
    averageCustomerValue: lifetimePayers.size ? lifetimeRevenue / lifetimePayers.size : null,
    purchaseFrequency: payers.size ? inPeriod.length / payers.size : null,
  };
}

async function proofStats(sources: Sources, current: Range, previous: Range) {
  const unpaid = sources.orders.filter((order) => ["SUBMITTED", "AWAITING_PAYMENT"].includes(normalizeOrderStatus(order.status)));
  const uploads = await proofUploadTimes(unpaid.map((order) => order.id)).catch(() => new Map<number, string>());
  const times = [...uploads.values()].map((value) => parseInstant(value));

  return {
    awaitingReview: uploads.size,
    uploadedCurrent: times.filter((time) => inRange(time, current)).length,
    uploadedPrevious: times.filter((time) => inRange(time, previous)).length,
  };
}

export type Insight = { key: string; tone: "up" | "down" | "info" | "attention"; title: string; body: string };

/** Insight cards — only emitted when the numbers support them. */
function buildInsights(input: {
  revenueNow: number;
  revenuePrev: number;
  salesNow: number;
  topShare: { name: string; share: number } | null;
  renewalsNow: number;
  renewalsPrev: number;
  proofs: { uploadedCurrent: number; uploadedPrevious: number; awaitingReview: number };
  periodLabel: string;
}): Insight[] {
  const cards: Insight[] = [];
  const change = percentChange(input.revenueNow, input.revenuePrev);

  if (change !== null && Math.abs(change) >= 5 && input.revenuePrev > 0) {
    cards.push({
      key: "revenue",
      tone: change > 0 ? "up" : "down",
      title: change > 0 ? "REVENUE_UP" : "REVENUE_DOWN",
      body: `${Math.abs(change).toFixed(1)}`,
    });
  }

  if (input.topShare && input.salesNow >= 3 && input.topShare.share >= 30) {
    cards.push({ key: "top-product", tone: "info", title: "TOP_PRODUCT", body: `${input.topShare.name}|${input.topShare.share.toFixed(1)}` });
  }

  if (input.renewalsPrev > 0 || input.renewalsNow > 0) {
    const renewalChange = percentChange(input.renewalsNow, input.renewalsPrev);
    if (renewalChange !== null && Math.abs(renewalChange) >= 20 && input.renewalsPrev >= 2) {
      cards.push({ key: "renewals", tone: renewalChange > 0 ? "up" : "down", title: renewalChange > 0 ? "RENEWALS_UP" : "RENEWALS_DOWN", body: `${input.renewalsNow}|${input.renewalsPrev}` });
    }
  }

  if (input.proofs.uploadedCurrent > input.proofs.uploadedPrevious && input.proofs.awaitingReview > 0) {
    cards.push({ key: "proofs", tone: "attention", title: "PROOFS_UP", body: `${input.proofs.awaitingReview}|${input.proofs.uploadedCurrent}|${input.proofs.uploadedPrevious}` });
  }

  return cards;
}

/** Metrics the system does not collect — shown as unavailable, never estimated. */
export const DATA_GAPS = ["TRAFFIC", "APP_USAGE", "SALES_CHANNEL"] as const;

/** Everything Admin → Finance shows for a selection, computed in one pass. */
export async function getFinanceSnapshot(selection: PeriodSelection, now = new Date()) {
  const sources = await loadFinanceSources();
  const { current, previous } = resolveRange(selection.period, now, { from: selection.from, to: selection.to });
  const sales = sources.sales;
  const revenueNow = sumSales(sales, current);
  const revenuePrev = sumSales(sales, previous);
  const anyExpense = sources.expenses.length > 0;
  const expensesNow = sumExpenses(sources.expenses, current);
  const expensesPrev = sumExpenses(sources.expenses, previous);
  const products = productPerformance(sales, current);
  const productsPrev = productPerformance(sales, previous);
  const leader = mostSold(products);
  const ordersNow = orderStats(sources, current, sales);
  const ordersPrev = orderStats(sources, previous, sales);
  const customersNow = customerStats(sources, current, sales);
  const customersPrev = customerStats(sources, previous, sales);
  const proofs = await proofStats(sources, current, previous);
  const trend = trendRange(selection.view, now);

  // Headline period cards (always the four calendar periods).
  const quick = (["today", "week", "month", "year"] as const).map((key) => {
    const ranges = resolveRange(key, now);
    const a = sumSales(sales, ranges.current);
    const b = sumSales(sales, ranges.previous);

    return { key, revenue: a.amount, sales: a.count, previous: b.amount, change: percentChange(a.amount, b.amount) };
  });

  return {
    selection,
    range: { current: { start: current.start.toISOString(), end: current.end.toISOString(), from: businessDay(current.start), to: businessDay(new Date(current.end.getTime() - 1)) }, previous: { start: previous.start.toISOString(), end: previous.end.toISOString() } },
    quick,
    revenue: { amount: revenueNow.amount, sales: revenueNow.count, previous: revenuePrev.amount, previousSales: revenuePrev.count, change: percentChange(revenueNow.amount, revenuePrev.amount) },
    expenses: { recorded: anyExpense, amount: expensesNow, previous: expensesPrev, change: anyExpense ? percentChange(expensesNow, expensesPrev) : null },
    profit: netProfit(revenueNow.amount, expensesNow, anyExpense),
    profitPrevious: netProfit(revenuePrev.amount, expensesPrev, anyExpense),
    trend: { view: selection.view, points: trendSeries(sales, sources.expenses, trend, selection.view) },
    products,
    productsPrevious: productsPrev,
    mostSold: leader,
    breakdown: revenueBreakdown(products),
    orders: { ...ordersNow, previous: ordersPrev, averageOrderValue: revenueNow.count ? revenueNow.amount / revenueNow.count : null, previousAverageOrderValue: revenuePrev.count ? revenuePrev.amount / revenuePrev.count : null },
    customers: { ...customersNow, previous: customersPrev },
    proofs,
    insights: buildInsights({
      revenueNow: revenueNow.amount,
      revenuePrev: revenuePrev.amount,
      salesNow: revenueNow.count,
      topShare: products[0] ? { name: products[0].name, share: products[0].share } : null,
      renewalsNow: customersNow.renewals,
      renewalsPrev: customersPrev.renewals,
      proofs,
      periodLabel: selection.period,
    }),
    dataGaps: [...DATA_GAPS, ...(anyExpense ? [] : (["EXPENSES"] as const))],
  };
}

export type FinanceSnapshot = Awaited<ReturnType<typeof getFinanceSnapshot>>;

export async function listExpenses(filter: { range?: Range; category?: string }) {
  const { expenses } = await loadFinanceSources();

  return expenses
    .filter((expense) => (!filter.range || inRange(parseInstant(expense.spentOn), filter.range)) && (!filter.category || expense.category === filter.category))
    .sort((a, b) => (parseInstant(b.spentOn)?.getTime() ?? 0) - (parseInstant(a.spentOn)?.getTime() ?? 0));
}
