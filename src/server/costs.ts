import { db } from "@/src/prisma/db";
import { costSnapshot, currentRate, normalizeChannel, parseCreditPurchase, rateIqdPerUsd, type CostSnapshot } from "@/src/lib/costs";
import { logActivity } from "@/src/server/activity";

/**
 * Real costs — database side. Credit purchases are append-only (the history
 * of rates); an order's cost is snapshotted once, when it completes, so later
 * purchases or credit edits never change past orders.
 */

type Actor = { id: number; role: string };

export async function listCreditPurchases() {
  const rows = await db.orm.public.CreditPurchase.orderBy([(row) => row.purchasedOn.desc(), (row) => row.id.desc()]).all();

  return rows.map((row) => ({
    id: row.id,
    purchasedOn: String(row.purchasedOn),
    creditCents: row.creditCents,
    iqdPaid: row.iqdPaid,
    note: row.note ?? null,
    rate: rateIqdPerUsd(row),
    createdAt: String(row.createdAt),
  }));
}

/** The latest purchase, whose rate prices every order completed from now on (null = none recorded). */
export async function currentCreditRate() {
  return currentRate(await listCreditPurchases());
}

/** Owner records a credit purchase. */
export async function addCreditPurchase(actor: Actor, input: Record<string, unknown>): Promise<{ ok: true; id: number } | { ok: false; status: number; error: string }> {
  if (String(actor.role).toUpperCase() !== "OWNER") {
    return { ok: false, status: 403, error: "تسجيل شراء الرصيد للمالك فقط." };
  }

  const parsed = parseCreditPurchase(input);

  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const { purchasedOn, creditCents, iqdPaid, note } = parsed.value;
  // Baghdad noon of the chosen day: a stable instant that sorts by date.
  const row = await db.orm.public.CreditPurchase.create({ purchasedOn: `${purchasedOn}T09:00:00.000Z`, creditCents, iqdPaid, note, createdBy: actor.id });

  await logActivity({
    actor,
    entityType: "FINANCE",
    entityId: row.id,
    action: "CREDIT_PURCHASE_ADDED",
    summary: `شراء رصيد: $${(creditCents / 100).toFixed(2)} بـ ${iqdPaid} د.ع (${Math.round(rateIqdPerUsd(row))} د.ع للدولار)`,
    details: note,
  });

  return { ok: true, id: row.id };
}

/**
 * The cost an order stores when it completes: its length's panel credit at
 * the current rate (SITE), a known zero (SUPPLIER), or unknown. Never throws:
 * an unknown cost must not block a completion.
 */
export async function snapshotForOrder(order: { channel?: string | null; packageOptionId: number | null }): Promise<CostSnapshot> {
  try {
    const channel = normalizeChannel(order.channel);

    if (channel === "SUPPLIER") return costSnapshot("SUPPLIER", null, null);

    const option = order.packageOptionId ? await db.orm.public.PackageOption.first({ id: order.packageOptionId }) : null;
    const rate = option?.creditCostCents != null ? await currentCreditRate() : null;

    return costSnapshot("SITE", option?.creditCostCents ?? null, rate);
  } catch (error) {
    console.error("COST_SNAPSHOT_ERROR:", error);
    return { creditCostCents: null, creditCostIqd: null, creditPurchaseId: null };
  }
}
