/**
 * Phase 6, step 2 — backfill subscription terms from receipts.
 *
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/bi/backfill-terms.mts          (check: reads only)
 *   node --experimental-strip-types --import ./tests/register-alias.mjs scripts/bi/backfill-terms.mts --apply  (writes)
 *
 * Adds one subscriptionTerm per receipt that has none, replayed with the
 * activation rule (src/lib/subscription-terms.ts). Idempotent: a second run
 * adds nothing. Writes only subscriptionTerm rows; never touches
 * subscriptions, receipts or orders. Prints counts and the database host only.
 * On production it needs the owner's approval, and migration
 * 20261113T1517_subscription_terms applied first.
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

const apply = process.argv.includes("--apply");
const { backfillTerms } = await import("@/src/server/subscription-terms");
const result = await backfillTerms({ apply });

console.log(`\nفترات الاشتراكات من الوصولات — ${host} — ${apply ? "تطبيق (يكتب)" : "فحص فقط (ما يكتب شي)"}\n`);
console.log(`  الاشتراكات: ${result.subscriptions}`);
console.log(`  الوصولات: ${result.receipts}`);
console.log(`  مسجّلة من قبل: ${result.alreadyRecorded}`);
console.log(`  راح تنضاف: ${result.toAdd} (منها مطابقة لتاريخ الانتهاء: ${result.toAddMatching})`);
console.log(`  اشتراكات تاريخها ما يطابق (تعديل يدوي): ${result.mismatchedSubscriptions}`);
console.log(`  اشتراكات ما انحسبت كاملة: ${result.unreplayableSubscriptions}`);
console.log(`  وصولات لاشتراك غير موجود: ${result.orphanReceipts}`);
console.log(apply ? `  انضافت فعلًا: ${result.added}\n` : "\n  للتطبيق: أعد التشغيل ويّه --apply\n");
console.log(JSON.stringify({ apply, ...result }));

process.exit(0);
