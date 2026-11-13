/**
 * Phase 6, step 1 — subscription-history data audit. READ-ONLY.
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/bi/audit.mts
 *
 * Reads only the columns it needs (never usernames, passwords, MAC, device
 * ids, names, phones, proofs or notes) from subscriptions, receipts, orders
 * and SUBSCRIPTION_UPDATED events, and prints counts, percentages and months.
 * It writes nothing. The database is DATABASE_URL (shell first, then .env);
 * only its host is printed. Rules: src/lib/bi-audit.ts; docs/bi/data-audit.md.
 */
await import("dotenv/config");

const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

if (!host) {
  console.error("DATABASE_URL is missing.");
  process.exit(2);
}

const { db } = await import("@/src/prisma/db");
const { buildAudit } = await import("@/src/lib/bi-audit");

const o = db.orm.public;
const [subscriptions, receipts, orders, events] = await Promise.all([
  o.Subscription.select("id", "userId", "serviceType", "status", "startDate", "expiryDate", "createdAt").all(),
  o.Receipt.select("subscriptionId", "durationMonths", "createdAt", "orderId").all(),
  o.SubscriptionRequest.select("id", "status", "requestType", "channel", "subscriptionId", "loyaltyReward").all(),
  o.ActivityEvent.where({ action: "SUBSCRIPTION_UPDATED" }).select("action", "entityId").all(),
]);

const s = (value: unknown) => String(value ?? "");
const result = buildAudit({
  subscriptions: subscriptions.map((row) => ({ id: row.id, userId: row.userId, serviceType: s(row.serviceType), status: s(row.status), startDate: s(row.startDate), expiryDate: s(row.expiryDate), createdAt: s(row.createdAt) })),
  receipts: receipts.map((row) => ({ subscriptionId: row.subscriptionId, durationMonths: row.durationMonths, createdAt: s(row.createdAt), orderId: row.orderId ?? null })),
  orders: orders.map((row) => ({ id: row.id, status: s(row.status).toUpperCase(), requestType: s(row.requestType).toUpperCase(), channel: s(row.channel), subscriptionId: row.subscriptionId ?? null, loyaltyReward: Boolean(row.loyaltyReward) })),
  events: events.map((row) => ({ action: s(row.action), entityId: row.entityId ?? null })),
});

const h = result.history;
const line = (ar: string, value: unknown) => console.log(`  ${ar}: ${typeof value === "object" ? JSON.stringify(value) : value}`);

console.log(`\nفحص بيانات الاشتراكات (قراءة فقط) — ${host} — ${result.today}\n`);
console.log("الاشتراكات");
line("المجموع", result.subscriptions.total);
line("حسب الخدمة", result.subscriptions.byService);
line("منتهية الآن", result.subscriptions.expiredNow);
line("أشهر الإنشاء", result.subscriptions.createdMonths);
line("زبائن عندهم أكثر من اشتراك لنفس الخدمة", result.subscriptions.customersWithSeveralOfOneService);
console.log("الوصولات");
line("المجموع", result.receipts.total);
line("مرتبطة بطلب / بدون طلب", `${result.receipts.withOrder} / ${result.receipts.withoutOrder}`);
line("لاشتراك غير موجود", result.receipts.forUnknownSubscription);
line("الأشهر", result.receipts.months);
console.log("التاريخ (إعادة بناء تاريخ الانتهاء من الوصولات)");
line("اشتراكات بوصولات / بدون وصولات", `${h.withReceipts} / ${h.withoutReceipts}`);
line("عدد الوصولات لكل اشتراك", h.receiptsPerSubscription);
line("مطابق تمامًا / قريب (≤7 أيام) / مختلف", `${h.replay.exact} / ${h.replay.close} / ${h.replay.off}`);
line("نسبة التغطية من كل الاشتراكات", `${h.coveragePct}%`);
console.log("الطلبات المكتملة");
line("حسب النوع", result.orders.completedByType);
line("بدون اشتراك مرتبط (عدا الأجهزة)", result.orders.completedWithoutSubscription);
line("بدون وصل (عدا الأجهزة)", result.orders.completedWithoutReceipt);
line("عن طريق المورّد / مكافآت نقاط", `${result.orders.supplierCompleted} / ${result.orders.rewardCompleted}`);
console.log("تعديلات يدوية على الاشتراكات");
line("تعديلات / اشتراكات معدّلة", `${result.manualEdits.events} / ${result.manualEdits.subscriptions}`);
console.log(`\nالنتيجة: ${result.verdict}  (FULL = التاريخ كامل، PARTIAL = جزئي، FORWARD_ONLY = نبدأ من اليوم)\n`);
console.log(JSON.stringify(result));

process.exit(0);
