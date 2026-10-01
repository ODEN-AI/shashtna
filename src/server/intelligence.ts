import { BUSINESS_TIME_ZONE, addDays, bucketKey, bucketKeys, businessDay, parseBusinessDay, resolveRange, type Range } from "@/src/lib/business-time";
import { matchesView } from "@/src/lib/content-console";
import { loadSection, type Gated } from "@/src/lib/dashboard-section";
import { inRange, parseInstant } from "@/src/lib/finance";
import {
  PAID_EVENT_ACTIONS,
  allowedSections,
  canSection,
  compare,
  firstResponseTimes,
  processingTimes,
  round1,
  structuralGaps,
  type IntelSection,
  type IntelligencePack,
} from "@/src/lib/intelligence";
import type { Lang } from "@/src/lib/i18n";
import { normalizeOrderStatus, UNPAID_STORED_STATUSES } from "@/src/lib/order-status";
import { isStaffRole, normalizeRole } from "@/src/lib/roles";
import { EXPIRING_WINDOW_DAYS, deriveSubscriptionState } from "@/src/lib/subscription-state";
import { ENDING_SOON_DAYS } from "@/src/lib/content-console";
import { getAllSupportTickets } from "@/src/lib/support-store";
import { db } from "@/src/prisma/db";
import { countOrders, listRenewalsDue } from "@/src/server/admin-queues";
import { getCatalogueOverview } from "@/src/server/catalogue";
import { getFinanceSnapshot, getSalesVolume, parseSelection, type PeriodSelection } from "@/src/server/finance";
import { proofUploadTimes } from "@/src/server/payment-proofs";
import { loadContent } from "@/src/server/promotions-console";

/**
 * Shashtna Intelligence — read layer.
 *
 * Every number comes from an existing engine: money only from the Finance
 * engine (getFinanceSnapshot), sales volume from the same recognition rules
 * without amounts (getSalesVolume), subscription states from
 * deriveSubscriptionState, order times from ActivityEvent timestamps.
 *
 * Each section is loaded only when the role holds its permission (checked
 * here, on the server, before any query runs) and reports failure on its
 * own: `null` = not allowed / not requested, `{ ok: false }` = failed to
 * load (shown as unavailable, never as zero).
 */

const MAX_CUSTOM_DAYS = 366;
const ID_CHUNK = 500;

/** The Finance period selection, plus the Intelligence presets; custom ranges are capped. */
export function parseIntelSelection(params: { period?: string; from?: string; to?: string }): PeriodSelection {
  const selection = parseSelection({ period: params.period ?? "last30", from: params.from, to: params.to, view: "day" });

  if (selection.period === "custom") {
    const from = parseBusinessDay(selection.from);
    const to = parseBusinessDay(selection.to);
    if (from && to && to.getTime() - from.getTime() > (MAX_CUSTOM_DAYS - 1) * 86_400_000) {
      return { ...selection, from: businessDay(addDays(to, -(MAX_CUSTOM_DAYS - 1))) };
    }
  }

  return selection;
}

export function rangesOf(selection: PeriodSelection, now = new Date()) {
  const ranges = resolveRange(selection.period, now, { from: selection.from, to: selection.to });

  return {
    ...ranges,
    from: businessDay(ranges.current.start),
    to: businessDay(new Date(ranges.current.end.getTime() - 1)),
    previousFrom: businessDay(ranges.previous.start),
    previousTo: businessDay(new Date(ranges.previous.end.getTime() - 1)),
  };
}

type Ranges = ReturnType<typeof rangesOf>;

const between = (range: Range) => ({ start: range.start.toISOString(), end: range.end.toISOString() });

// ------------------------------------------------------------------ sections

/** Money — the Finance snapshot itself (finance permission only). */
async function financeSection(selection: PeriodSelection) {
  const snapshot = await getFinanceSnapshot(selection);
  const expenses = snapshot.expenses.recorded ? compare(snapshot.expenses.amount, snapshot.expenses.previous) : null;

  return {
    snapshot,
    pack: {
      revenue: compare(snapshot.revenue.amount, snapshot.revenue.previous),
      completedSales: compare(snapshot.revenue.sales, snapshot.revenue.previousSales),
      averageOrderValue: {
        current: snapshot.orders.averageOrderValue === null ? null : Math.round(snapshot.orders.averageOrderValue),
        previous: snapshot.orders.previousAverageOrderValue === null ? null : Math.round(snapshot.orders.previousAverageOrderValue),
      },
      expensesRecorded: snapshot.expenses.recorded,
      expenses,
      netProfit: {
        status: snapshot.profit.status,
        current: snapshot.profit.status === "ok" ? snapshot.profit.amount : null,
        previous: snapshot.profitPrevious.status === "ok" ? snapshot.profitPrevious.amount : null,
      },
      topProducts: snapshot.products.slice(0, 5).map((row) => ({ name: row.name, revenue: row.revenue, sharePct: round1(row.share) })),
    } satisfies IntelligencePack["finance"],
  };
}

/** Sales volume — counts only, no amounts. */
async function salesSection(selection: PeriodSelection) {
  const volume = await getSalesVolume(selection);
  const previousUnits = new Map(volume.productsPrevious.map((row) => [row.product, row.units]));

  return {
    volume,
    pack: {
      completedSales: compare(volume.completedSales.current, volume.completedSales.previous),
      products: volume.products.slice(0, 8).map((row) => ({ name: row.name, kind: row.kind, units: row.units, previousUnits: previousUnits.get(row.product) ?? 0 })),
      mostSold: volume.mostSold,
    } satisfies IntelligencePack["sales"],
  };
}

async function ordersCreated(range: Range) {
  const { start, end } = between(range);

  return db.orm.public.SubscriptionRequest.where((order) => order.createdAt.gte(start))
    .where((order) => order.createdAt.lt(end))
    .select("id", "status", "requestType", "createdAt")
    .all();
}

/** Events for a bounded set of orders, in chunks (no per-order queries). */
async function orderEvents(ids: number[]) {
  const out: { orderId: number; action: string; at: string }[] = [];

  for (let index = 0; index < ids.length; index += ID_CHUNK) {
    const chunk = ids.slice(index, index + ID_CHUNK).map(String);
    const rows = await db.orm.public.ActivityEvent.where({ entityType: "ORDER" })
      .where((event) => event.action.in([...PAID_EVENT_ACTIONS]))
      .where((event) => event.entityId.in(chunk))
      .select("entityId", "action", "createdAt")
      .all();
    for (const row of rows) out.push({ orderId: Number(row.entityId), action: row.action, at: String(row.createdAt) });
  }

  return out;
}

/** Orders: volume, status mix, the live queue, and processing times from events. */
async function ordersSection(ranges: Ranges) {
  const [now, before, awaitingPayment, ready, unpaid] = await Promise.all([
    ordersCreated(ranges.current),
    ordersCreated(ranges.previous),
    countOrders(UNPAID_STORED_STATUSES),
    countOrders(["PAID", "FULFILLING"]),
    db.orm.public.SubscriptionRequest.where((order) => order.status.in(UNPAID_STORED_STATUSES)).select("id").all(),
  ]);
  const [events, proofs] = await Promise.all([orderEvents(now.map((order) => order.id)), proofUploadTimes(unpaid.map((order) => order.id))]);
  const normalized = (rows: typeof now) => rows.map((row) => ({ ...row, status: normalizeOrderStatus(row.status), createdAt: String(row.createdAt) }));
  const current = normalized(now);
  const previous = normalized(before);
  const count = (rows: typeof current, statuses: string[]) => rows.filter((row) => statuses.includes(row.status)).length;
  const tally = (rows: typeof current, key: "status" | "requestType") => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(String(row[key]), (map.get(String(row[key])) ?? 0) + 1);
    return [...map.entries()].map(([name, n]) => ({ key: name, count: n })).sort((a, b) => b.count - a.count);
  };
  const times = processingTimes(current, events);
  const paid = count(current, ["PAID", "FULFILLING", "COMPLETED"]);

  return {
    byStatus: tally(current, "status"),
    byType: tally(current, "requestType"),
    pack: {
      created: compare(current.length, previous.length),
      cancelled: compare(count(current, ["CANCELLED"]), count(previous, ["CANCELLED"])),
      paidOfCreatedPct: current.length ? round1((paid / current.length) * 100) : null,
      awaitingPaymentNow: awaitingPayment,
      proofsAwaitingReviewNow: proofs.size,
      readyToActivateNow: ready,
      createdToPaid: times.createdToPaid,
      paidToCompleted: times.paidToCompleted,
    } satisfies IntelligencePack["orders"],
  };
}

/** Customers: sign-ups (SQL, bounded) and paying / returning counts from the sales engine. */
async function customersSection(selection: PeriodSelection, ranges: Ranges) {
  const window = between({ start: ranges.previous.start, end: ranges.current.end });
  const [joined, roles, volume] = await Promise.all([
    db.orm.public.User.where((user) => user.createdAt.gte(window.start))
      .where((user) => user.createdAt.lt(window.end))
      .select("role", "createdAt")
      .all(),
    db.orm.public.User.groupBy("role").aggregate((a) => ({ n: a.count() })),
    getSalesVolume(selection),
  ]);
  const customers = joined.filter((user) => !isStaffRole(normalizeRole(user.role))).map((user) => parseInstant(String(user.createdAt)));
  const inCurrent = customers.filter((at) => inRange(at, ranges.current));
  const granularity = ranges.granularity;
  const series = new Map(bucketKeys(ranges.current, granularity).map((key) => [key, 0]));
  for (const at of inCurrent) if (at) series.set(bucketKey(at, granularity), (series.get(bucketKey(at, granularity)) ?? 0) + 1);

  return {
    signups: { granularity, points: [...series.entries()].map(([key, value]) => ({ key, value })) },
    pack: {
      new: compare(inCurrent.length, customers.filter((at) => inRange(at, ranges.previous)).length),
      paying: compare(volume.customers.paying, volume.customers.previousPaying),
      returning: volume.customers.returning,
      firstTime: volume.customers.firstTime,
      total: roles.filter((row) => !isStaffRole(normalizeRole(row.role))).reduce((sum, row) => sum + Number(row.n), 0),
    } satisfies IntelligencePack["customers"],
  };
}

/** Subscriptions: states right now (deriveSubscriptionState), the renewal window, renewals in the period. */
async function subscriptionsSection(selection: PeriodSelection) {
  const [rows, due, volume] = await Promise.all([
    db.orm.public.Subscription.select("status", "expiryDate", "packageName").all(),
    listRenewalsDue(),
    getSalesVolume(selection),
  ]);
  const states = rows.map((row) => ({ name: row.packageName, state: deriveSubscriptionState({ status: row.status, expiryDate: String(row.expiryDate) }) }));
  const byPackage = new Map<string, { active: number; expiring: number; expired: number }>();
  for (const { name, state } of states) {
    const entry = byPackage.get(name) ?? { active: 0, expiring: 0, expired: 0 };
    if (state === "ACTIVE" || state === "EXPIRING") entry.active += 1;
    if (state === "EXPIRING") entry.expiring += 1;
    if (state === "EXPIRED") entry.expired += 1;
    byPackage.set(name, entry);
  }
  const packages = [...byPackage.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
  const count = (wanted: string[]) => states.filter((item) => wanted.includes(item.state)).length;

  return {
    packages,
    pack: {
      expiringWindowDays: EXPIRING_WINDOW_DAYS,
      active: count(["ACTIVE", "EXPIRING"]),
      expiring: count(["EXPIRING"]),
      expired: count(["EXPIRED"]),
      suspended: count(["SUSPENDED"]),
      dueForRenewal: due.length,
      renewals: compare(volume.renewals.current, volume.renewals.previous),
      byPackage: packages.slice(0, 8).map(({ name, active }) => ({ name, active })),
    } satisfies IntelligencePack["subscriptions"],
  };
}

/** Support: the file store's tickets and their message timestamps. */
async function supportSection(ranges: Ranges) {
  const tickets = await getAllSupportTickets();
  const created = (range: Range) => tickets.filter((ticket) => inRange(parseInstant(ticket.createdAt), range));
  const current = created(ranges.current);
  const open = tickets.filter((ticket) => ticket.status !== "CLOSED");

  return {
    pack: {
      created: compare(current.length, created(ranges.previous).length),
      open: open.length,
      waitingOnTeam: open.filter((ticket) => ticket.lastSender === "CUSTOMER").length,
      firstResponse: firstResponseTimes(current),
    } satisfies IntelligencePack["support"],
  };
}

/** Promotions & content: lifecycle states (shared rules) and notification counts. */
async function promotionsSection(ranges: Ranges) {
  const window = between({ start: ranges.previous.start, end: ranges.current.end });
  const [content, notifications] = await Promise.all([
    loadContent(),
    db.orm.public.Notification.where((item) => item.createdAt.gte(window.start))
      .where((item) => item.createdAt.lt(window.end))
      .select("type", "readAt", "createdAt")
      .all(),
  ]);
  const now = Date.now();
  const endsAt = (value: string | null) => (value ? (parseInstant(value)?.getTime() ?? null) : null);
  const lifecycle = (state: string) => content.filter((row) => row.lifecycle === state).length;
  const sentIn = (range: Range) => notifications.filter((item) => inRange(parseInstant(String(item.createdAt)), range));
  const current = sentIn(ranges.current);
  const byType = new Map<string, { sent: number; read: number }>();
  for (const item of current) {
    const entry = byType.get(item.type) ?? { sent: 0, read: 0 };
    entry.sent += 1;
    if (item.readAt) entry.read += 1;
    byType.set(item.type, entry);
  }

  return {
    byType: [...byType.entries()].map(([type, value]) => ({ type, ...value })).sort((a, b) => b.sent - a.sent),
    missingMedia: content.filter((row) => row.lifecycle === "LIVE" && !row.imageUrl && !row.videoUrl).length,
    pack: {
      endingSoonDays: ENDING_SOON_DAYS,
      live: lifecycle("LIVE"),
      scheduled: lifecycle("SCHEDULED"),
      ended: lifecycle("ENDED"),
      inactive: lifecycle("INACTIVE"),
      endingSoon: content.filter((row) => matchesView("ending", row.lifecycle, endsAt(row.endsAt), now)).length,
      notificationsSent: compare(current.length, sentIn(ranges.previous).length),
      notificationsRead: current.filter((item) => item.readAt).length,
    } satisfies IntelligencePack["promotions"],
  };
}

// ------------------------------------------------------------------ loading

type Loaded = {
  finance: Gated<Awaited<ReturnType<typeof financeSection>>>;
  sales: Gated<Awaited<ReturnType<typeof salesSection>>>;
  orders: Gated<Awaited<ReturnType<typeof ordersSection>>>;
  customers: Gated<Awaited<ReturnType<typeof customersSection>>>;
  subscriptions: Gated<Awaited<ReturnType<typeof subscriptionsSection>>>;
  support: Gated<Awaited<ReturnType<typeof supportSection>>>;
  promotions: Gated<Awaited<ReturnType<typeof promotionsSection>>>;
};

/**
 * Load the requested sections the role may see. A section that is not
 * allowed is never queried — the permission check happens before the load.
 */
export async function loadIntelligence(role: string, selection: PeriodSelection, wanted: readonly IntelSection[]) {
  const ranges = rangesOf(selection);
  const want = (section: IntelSection) => wanted.includes(section) && canSection(role, section);

  const [finance, sales, orders, customers, subscriptions, support, promotions] = await Promise.all([
    loadSection(want("finance"), "INTEL_FINANCE", () => financeSection(selection)),
    loadSection(want("sales"), "INTEL_SALES", () => salesSection(selection)),
    loadSection(want("orders"), "INTEL_ORDERS", () => ordersSection(ranges)),
    loadSection(want("customers"), "INTEL_CUSTOMERS", () => customersSection(selection, ranges)),
    loadSection(want("subscriptions"), "INTEL_SUBSCRIPTIONS", () => subscriptionsSection(selection)),
    loadSection(want("support"), "INTEL_SUPPORT", () => supportSection(ranges)),
    loadSection(want("promotions"), "INTEL_PROMOTIONS", () => promotionsSection(ranges)),
  ]);

  const loaded: Loaded = { finance, sales, orders, customers, subscriptions, support, promotions };

  return { selection, ranges, timeZone: BUSINESS_TIME_ZONE, ...loaded };
}

export type Intelligence = Awaited<ReturnType<typeof loadIntelligence>>;

/** Non-financial catalogue counts (catalogue / insights roles). */
export async function loadCatalogueCounts(role: string) {
  return loadSection(true, "INTEL_CATALOGUE", async () => {
    const overview = await getCatalogueOverview(role);
    if (!overview.ok) throw new Error("CATALOGUE_UNAVAILABLE");

    return {
      packagesActive: overview.packages.active,
      packagesInactive: overview.packages.inactive,
      packagesWithoutDevices: overview.packages.noDevices.length,
      devicesActive: overview.devices.active,
      devicesTotal: overview.devices.total,
      devicesUnlinked: overview.devices.unlinked.length,
    };
  });
}

// ------------------------------------------------------------------ fact pack

const PERIOD_TEXT: Record<string, [string, string]> = {
  today: ["اليوم", "today"],
  week: ["هذا الأسبوع", "this week"],
  month: ["هذا الشهر", "this month"],
  year: ["هذه السنة", "this year"],
  last7: ["آخر 7 أيام", "the last 7 days"],
  last30: ["آخر 30 يوم", "the last 30 days"],
  last90: ["آخر 90 يوم", "the last 90 days"],
  prevMonth: ["الشهر السابق", "the previous month"],
  custom: ["فترة مخصصة", "custom range"],
};

const COMPARISON_TEXT: Record<string, [string, string]> = {
  today: ["مقارنة بنفس الوقت أمس", "vs the same time yesterday"],
  week: ["مقارنة بنفس النقطة من الأسبوع الماضي", "vs the same point last week"],
  month: ["مقارنة بنفس النقطة من الشهر الماضي", "vs the same point last month"],
  year: ["مقارنة بنفس النقطة من السنة الماضية", "vs the same point last year"],
  prevMonth: ["مقارنة بالشهر الذي قبله كاملًا", "vs the full month before it"],
};

const SECTION_FAILED: Record<IntelSection, [string, string]> = {
  finance: ["تعذر تحميل البيانات المالية لهذه الفترة.", "Financial data could not be loaded for this period."],
  sales: ["تعذر تحميل حجم المبيعات.", "Sales volume could not be loaded."],
  orders: ["تعذر تحميل بيانات الطلبات.", "Order data could not be loaded."],
  customers: ["تعذر تحميل بيانات العملاء.", "Customer data could not be loaded."],
  subscriptions: ["تعذر تحميل بيانات الاشتراكات.", "Subscription data could not be loaded."],
  support: ["تعذر تحميل بيانات الدعم.", "Support data could not be loaded."],
  promotions: ["تعذر تحميل بيانات المحتوى والإشعارات.", "Content and notification data could not be loaded."],
};

/**
 * The verified fact pack: aggregates and product / package names only (no
 * customer names, phones, credentials, proofs or secrets). Sections the
 * role may not see were never loaded; sections that failed are listed as
 * unavailable instead of appearing as zero.
 */
export function buildIntelligencePack(data: Intelligence, lang: Lang): IntelligencePack {
  const ar = lang === "ar";
  const key = data.selection.period;
  const pick = ([a, e]: [string, string]) => (ar ? a : e);
  const sections: IntelSection[] = [];
  const failed: string[] = [];
  const pack: IntelligencePack = {
    kind: "intelligence",
    period: {
      key,
      label: pick(PERIOD_TEXT[key] ?? PERIOD_TEXT.custom),
      from: data.ranges.from,
      to: data.ranges.to,
      comparison: pick(COMPARISON_TEXT[key] ?? ["مقارنة بفترة سابقة بنفس الطول", "vs the previous period of the same length"]),
      timeZone: data.timeZone,
    },
    currency: "IQD",
    sections,
    unavailable: [],
  };

  const take = <K extends IntelSection>(section: K, value: Gated<{ pack: NonNullable<IntelligencePack[K]> }>) => {
    if (value === null) return;
    if (!value.ok) {
      failed.push(pick(SECTION_FAILED[section]));
      return;
    }
    sections.push(section);
    (pack as Record<string, unknown>)[section] = value.data.pack;
  };

  take("finance", data.finance);
  take("sales", data.sales);
  take("orders", data.orders);
  take("customers", data.customers);
  take("subscriptions", data.subscriptions);
  take("support", data.support);
  take("promotions", data.promotions);

  pack.unavailable = [...failed, ...structuralGaps(sections, lang), ...(pack.finance && !pack.finance.expensesRecorded ? [pick(["لم تُسجَّل أي مصاريف بعد.", "No expenses have been recorded yet."])] : [])];

  return pack;
}

/** The sections the analyst may use for this role. */
export function analystSections(role: string) {
  return allowedSections(role);
}
