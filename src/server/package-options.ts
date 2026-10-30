import { db } from "@/src/prisma/db";
import { defaultOption, packageMirror, sortOptions, type PackageOption, type ParsedOption } from "@/src/lib/package-options";
import { formatDurationAr } from "@/src/lib/subscription-duration";

/**
 * Package options — database side. Options are saved with their package (in
 * one transaction), and the package's own price / renewalPrice / duration*
 * columns are re-mirrored from its default option on every save, so older
 * readers keep seeing a real, sellable length and price.
 */

type OptionRow = Awaited<ReturnType<typeof db.orm.public.PackageOption.first>> & {};

function toOption(row: NonNullable<OptionRow>): PackageOption {
  return {
    id: row.id,
    durationMonths: row.durationMonths,
    durationUnit: row.durationUnit,
    durationLabel: row.durationLabel,
    price: row.price,
    renewalPrice: row.renewalPrice ?? null,
    pointsEarned: row.pointsEarned ?? null,
    creditCostCents: row.creditCostCents ?? null,
    isActive: row.isActive,
  };
}

/** Every option (active or not) of the given packages, shortest first. */
export async function optionsByPackage(packageIds: number[]) {
  const unique = [...new Set(packageIds)];
  const rows = unique.length ? await db.orm.public.PackageOption.where((option) => option.packageId.in(unique)).all() : [];
  const map = new Map<number, PackageOption[]>(unique.map((id) => [id, []]));

  for (const row of rows) map.get(row.packageId)?.push(toOption(row));
  for (const [id, options] of map) map.set(id, sortOptions(options));

  return map;
}

export async function packageOptions(packageId: number) {
  return (await optionsByPackage([packageId])).get(packageId) ?? [];
}

export type OptionChanges = { added: number[]; updated: number[]; removed: number[]; deactivated: number[] };

/** "6 أشهر 10000 / تجديد —" — for the audit log. */
export function describeOption(option: { durationMonths: number; price: number; renewalPrice: number | null; pointsEarned?: number | null; creditCostCents?: number | null; isActive?: boolean }) {
  return `${formatDurationAr(option.durationMonths)} ${option.price}${option.renewalPrice !== null ? ` / renewal ${option.renewalPrice}` : ""}${typeof option.pointsEarned === "number" ? ` / points ${option.pointsEarned}` : ""}${typeof option.creditCostCents === "number" ? ` / credit ${option.creditCostCents}c` : ""}${option.isActive === false ? " (inactive)" : ""}`;
}

/**
 * Replaces a package's options with the ones the admin saved:
 * - an option sent with its id is updated;
 * - a new option whose length matches an existing, unsent option reuses
 *   that row (so re-adding a removed length keeps its order history);
 * - an existing option left out is deleted, or only deactivated when orders
 *   reference it (their snapshots stay, the link is kept for history);
 * - the package's mirror columns follow the new default option.
 * Runs in one transaction: either every change lands or none does.
 */
export async function savePackageOptions(packageId: number, parsed: ParsedOption[]): Promise<{ ok: true; changes: OptionChanges; before: PackageOption[]; after: PackageOption[] } | { ok: false; status: number; error: string }> {
  const before = await packageOptions(packageId);
  const byId = new Map(before.map((option) => [option.id, option]));

  for (const option of parsed) {
    if (option.id !== null && !byId.has(option.id)) {
      return { ok: false, status: 409, error: "واحدة من المدد تغيّرت أو انحذفت من مكان ثاني. حدّث الصفحة وحاول مرة ثانية." };
    }
  }

  // New rows that take over an existing, unsent row of the same length.
  const sentIds = new Set(parsed.map((option) => option.id).filter((id): id is number => id !== null));
  const reusable = new Map(before.filter((option) => !sentIds.has(option.id)).map((option) => [option.durationMonths, option.id]));
  const plan = parsed.map((option) => ({ ...option, id: option.id ?? reusable.get(option.durationMonths) ?? null }));
  const keptIds = new Set(plan.map((option) => option.id).filter((id): id is number => id !== null));
  const leftOut = before.filter((option) => !keptIds.has(option.id));

  const referenced = new Set<number>();
  if (leftOut.length) {
    const orders = await db.orm.public.SubscriptionRequest.where((order) => order.packageOptionId.in(leftOut.map((option) => option.id))).select("packageOptionId").all();
    for (const order of orders) if (order.packageOptionId !== null) referenced.add(order.packageOptionId);
  }

  const changes: OptionChanges = { added: [], updated: [], removed: [], deactivated: [] };
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    const options = tx.orm.public.PackageOption;

    for (const option of leftOut) {
      if (referenced.has(option.id)) {
        // Park it on a length no live option can use, so it never blocks one.
        await options.where({ id: option.id }).update({ isActive: false, durationMonths: -option.id, updatedAt: now });
        changes.deactivated.push(option.id);
      } else {
        await options.where({ id: option.id }).deleteAndCount();
        changes.removed.push(option.id);
      }
    }

    // Two phases so lengths can swap (3 ↔ 6) without tripping the
    // one-option-per-length rule: park every changed length first.
    for (const option of plan) {
      const current = option.id !== null ? byId.get(option.id) : undefined;
      if (current && current.durationMonths !== option.durationMonths) {
        await options.where({ id: current.id }).update({ durationMonths: -current.id, updatedAt: now });
      }
    }

    for (const option of plan) {
      const fields = {
        durationMonths: option.durationMonths,
        durationUnit: option.durationUnit,
        durationLabel: option.durationLabel,
        price: option.price,
        renewalPrice: option.renewalPrice,
        ...(option.pointsEarned !== undefined ? { pointsEarned: option.pointsEarned } : {}),
        ...(option.creditCostCents !== undefined ? { creditCostCents: option.creditCostCents } : {}),
        isActive: option.isActive,
        updatedAt: now,
      };

      if (option.id !== null) {
        await options.where({ id: option.id }).update(fields);
        changes.updated.push(option.id);
      } else {
        const created = await options.create({ packageId, ...fields });
        changes.added.push(created.id);
      }
    }

    const fallback = defaultOption(plan.map((option, index) => ({ ...option, id: option.id ?? -index })));
    if (fallback) {
      await tx.orm.public.Package.where({ id: packageId }).update({ ...packageMirror(fallback), updatedAt: now });
    }
  });

  return { ok: true, changes, before, after: await packageOptions(packageId) };
}

/**
 * Keeps options in step when a package is edited the old way (price or
 * duration on the package itself, no options sent — the legacy admin page
 * and older console builds): the change applies to the package's default
 * option, which the package columns mirror.
 */
export async function syncDefaultOption(packageId: number, previous: { durationMonths: number }, next: { price: number; renewalPrice: number | null; durationMonths: number; durationUnit: string; durationLabel: string }): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const options = await packageOptions(packageId);
  const target = options.find((option) => option.durationMonths === previous.durationMonths) ?? defaultOption(options);
  const clash = options.find((option) => option.durationMonths === next.durationMonths && option.id !== target?.id);

  if (clash) {
    return { ok: false, status: 409, error: "هذه المدة موجودة أصلًا كمدة ثانية لنفس الباقة. عدّل المدد من صفحة الباقة." };
  }

  const fields = { ...packageMirror(next), isActive: true, updatedAt: new Date().toISOString() };

  if (target) {
    await db.orm.public.PackageOption.where({ id: target.id }).update(fields);
  } else {
    await db.orm.public.PackageOption.create({ packageId, ...fields });
  }

  return { ok: true };
}

/** Removes a package's options before the package itself is deleted (only allowed when nothing references it). */
export async function deletePackageOptions(packageId: number) {
  await db.orm.public.PackageOption.where({ packageId }).deleteAndCount();
}
