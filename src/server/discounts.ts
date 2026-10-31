import { db } from "@/src/prisma/db";
import { activeDiscount, isActiveAt, isScheduled, overlaps, parseDiscount, type DiscountKind, type DiscountRule } from "@/src/lib/discounts";
import { isFullAccess } from "@/src/lib/system";
import { logActivity } from "@/src/server/activity";

/**
 * Discounts — database side. One discount per package option at any moment:
 * every create / edit locks the option row and checks the windows of the
 * option's other discounts in the same transaction. Discounts are never
 * deleted; ending one sets `endedAt`. Changes are full-access only and audited.
 */

type Actor = { id: number; role: string };
type Fail = { ok: false; status: number; error: string };

const sql = db.raw.sql;

type DiscountRow = NonNullable<Awaited<ReturnType<typeof db.orm.public.Discount.first>>>;

function toRule(row: DiscountRow): DiscountRule & { packageOptionId: number } {
  return {
    id: row.id,
    packageOptionId: row.packageOptionId,
    kind: (String(row.kind).toUpperCase() === "AMOUNT" ? "AMOUNT" : "PERCENT") as DiscountKind,
    value: row.value,
    appliesToRenewals: row.appliesToRenewals,
    startsAt: row.startsAt ? String(row.startsAt) : null,
    endsAt: row.endsAt ? String(row.endsAt) : null,
    endedAt: row.endedAt ? String(row.endedAt) : null,
  };
}

/** The discount active right now for each option (null when none). */
export async function activeDiscounts(optionIds: number[], now = new Date()) {
  const unique = [...new Set(optionIds)];
  const rows = unique.length ? await db.orm.public.Discount.where((row) => row.packageOptionId.in(unique)).where((row) => row.endedAt.isNull()).all() : [];
  const byOption = new Map<number, ReturnType<typeof toRule>[]>(unique.map((id) => [id, []]));

  for (const row of rows) byOption.get(row.packageOptionId)?.push(toRule(row));

  return new Map(unique.map((id) => [id, activeDiscount(byOption.get(id) ?? [], now)]));
}

export async function activeDiscountFor(optionId: number | null | undefined, now = new Date()) {
  return optionId ? ((await activeDiscounts([optionId], now)).get(optionId) ?? null) : null;
}

/** Every discount of these options (the package form shows and edits them). */
export async function discountsForOptions(optionIds: number[]) {
  const rows = optionIds.length ? await db.orm.public.Discount.where((row) => row.packageOptionId.in(optionIds)).orderBy((row) => row.id.desc()).all() : [];

  return rows.map(toRule);
}

/** Active and scheduled discounts across the catalogue, with what they apply to (Admin → Discounts). */
export async function listCurrentDiscounts(now = new Date()) {
  const rows = (await db.orm.public.Discount.where((row) => row.endedAt.isNull()).all()).map(toRule).filter((rule) => isActiveAt(rule, now) || isScheduled(rule, now));
  const options = rows.length ? await db.orm.public.PackageOption.where((row) => row.id.in(rows.map((rule) => rule.packageOptionId))).all() : [];
  const packages = options.length ? await db.orm.public.Package.where((row) => row.id.in([...new Set(options.map((option) => option.packageId))])).all() : [];
  const optionOf = new Map(options.map((option) => [option.id, option]));
  const packageOf = new Map(packages.map((pkg) => [pkg.id, pkg]));

  return rows
    .map((rule) => {
      const option = optionOf.get(rule.packageOptionId);
      const pkg = option ? packageOf.get(option.packageId) : undefined;

      return { ...rule, status: isActiveAt(rule, now) ? ("ACTIVE" as const) : ("SCHEDULED" as const), option: option ? { id: option.id, durationMonths: option.durationMonths, durationLabel: option.durationLabel, price: option.price, renewalPrice: option.renewalPrice ?? null } : null, pkg: pkg ? { id: pkg.id, name: pkg.name, serviceType: String(pkg.serviceType).toUpperCase() } : null };
    })
    .sort((a, b) => (a.status === b.status ? a.id - b.id : a.status === "ACTIVE" ? -1 : 1));
}

function describe(rule: Pick<DiscountRule, "kind" | "value" | "appliesToRenewals" | "startsAt" | "endsAt" | "endedAt">) {
  return `${rule.kind === "PERCENT" ? `${rule.value}%` : `${rule.value} IQD`}; renewals ${rule.appliesToRenewals ? "yes" : "no"}; ${rule.startsAt ?? "—"} → ${rule.endsAt ?? "—"}${rule.endedAt ? `; ended ${rule.endedAt}` : ""}`;
}

/**
 * Create (no `discountId`) or edit a discount on an option. Refuses a window
 * that overlaps another discount of the same option.
 */
export async function saveDiscount(actor: Actor, optionId: number, raw: Record<string, unknown>, discountId?: number | null): Promise<{ ok: true; id: number } | Fail> {
  if (!isFullAccess(actor.role)) return { ok: false, status: 403, error: "إدارة الخصومات لصاحب الصلاحية الكاملة فقط." };

  const option = await db.orm.public.PackageOption.first({ id: optionId });

  if (!option || option.durationMonths <= 0) return { ok: false, status: 404, error: "المدة غير موجودة." };

  const parsed = parseDiscount(raw, { price: option.price, renewalPrice: option.renewalPrice ?? null });

  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const input = parsed.value;
  const now = new Date().toISOString();

  type Outcome = { ok: true; id: number; before: string | null } | Fail;

  const outcome: Outcome = await db.transaction(async (tx): Promise<Outcome> => {
    // Serialise every change to this option's discounts.
    await tx.query(sql`SELECT "id" FROM "public"."packageOption" WHERE "id" = ${optionId} FOR UPDATE`.returnsRow({ id: "pg/int4@1" }).build()).toArray();

    const existing = (await tx.orm.public.Discount.where({ packageOptionId: optionId }).where((row) => row.endedAt.isNull()).all()).map(toRule);
    const current = discountId ? existing.find((rule) => rule.id === discountId) : null;

    if (discountId && !current) return { ok: false, status: 404, error: "الخصم غير موجود أو منتهي." };

    const candidate = { startsAt: input.startsAt, endsAt: input.endsAt, endedAt: null };
    const clash = existing.find((rule) => rule.id !== discountId && overlaps(rule, candidate));

    if (clash) {
      return { ok: false, status: 409, error: "هذه المدة عليها خصم ثاني بنفس الفترة. أنهِ الخصم الثاني أو غيّر التواريخ." };
    }

    const fields = { kind: input.kind, value: input.value, appliesToRenewals: input.appliesToRenewals, startsAt: input.startsAt, endsAt: input.endsAt, updatedAt: now };

    if (current) {
      await tx.orm.public.Discount.where({ id: current.id }).update(fields);
      return { ok: true, id: current.id, before: describe(current) };
    }

    const created = await tx.orm.public.Discount.create({ packageOptionId: optionId, createdBy: actor.id, ...fields });
    return { ok: true, id: created.id, before: null };
  });

  if (!outcome.ok) return outcome;

  await logActivity({
    actor,
    entityType: "PACKAGE",
    entityId: option.packageId,
    action: outcome.before ? "DISCOUNT_UPDATED" : "DISCOUNT_CREATED",
    summary: `${outcome.before ? "تعديل" : "إضافة"} خصم على مدة ${option.durationLabel}: ${input.kind === "PERCENT" ? `${input.value}%` : `${input.value} د.ع`}`,
    details: `discount ${outcome.id}: ${outcome.before ?? "—"} → ${describe({ ...input, endedAt: null })}`,
  });

  return { ok: true, id: outcome.id };
}

/** End a discount now (kept for history; orders that used it keep their snapshot). */
export async function endDiscount(actor: Actor, discountId: number): Promise<{ ok: true } | Fail> {
  if (!isFullAccess(actor.role)) return { ok: false, status: 403, error: "إدارة الخصومات لصاحب الصلاحية الكاملة فقط." };

  const row = await db.orm.public.Discount.first({ id: discountId });

  if (!row || row.endedAt) return { ok: false, status: 404, error: "الخصم غير موجود أو منتهي." };

  const before = toRule(row);
  const now = new Date().toISOString();

  await db.orm.public.Discount.where({ id: discountId }).update({ endedAt: now, updatedAt: now });

  const option = await db.orm.public.PackageOption.first({ id: row.packageOptionId });

  await logActivity({
    actor,
    entityType: "PACKAGE",
    entityId: option?.packageId ?? null,
    action: "DISCOUNT_ENDED",
    summary: `إنهاء خصم على مدة ${option?.durationLabel ?? row.packageOptionId}`,
    details: `discount ${discountId}: ${describe(before)} → ended ${now}`,
  });

  return { ok: true };
}
