import { db } from "@/src/prisma/db";
import { isBuiltInGroup, normalizeDelivery, parseGroup } from "@/src/lib/groups";
import { hasPermission } from "@/src/lib/roles";
import { logActivity } from "@/src/server/activity";

/**
 * Plan groups — database side (Admin → Catalogue → Groups, "catalogue"
 * permission like packages). Every change is audited with before / after.
 * The built-in IPTV and VIP groups keep their slug, service and delivery;
 * the owner can rename, reorder or recolour them. Groups are never deleted:
 * hiding one hides its section (and its platform packages) from /plans.
 */

type Actor = { id: number; role: string };
type Fail = { ok: false; status: number; error: string };

export async function listGroups() {
  const rows = await db.orm.public.PackageGroup.all();
  const packages = await db.orm.public.Package.select("id", "groupId", "isActive").all();
  const count = new Map<number, { total: number; active: number }>();

  for (const pkg of packages) {
    if (!pkg.groupId) continue;
    const entry = count.get(pkg.groupId) ?? { total: 0, active: 0 };
    entry.total += 1;
    if (pkg.isActive) entry.active += 1;
    count.set(pkg.groupId, entry);
  }

  return rows
    .map((row) => ({ ...row, delivery: normalizeDelivery(row.delivery), builtIn: isBuiltInGroup(row.slug), packages: count.get(row.id) ?? { total: 0, active: 0 } }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function describe(row: { name: string; slug: string; sortOrder: number; isActive: boolean; accent: string; surface: string; delivery: string; logoUrl?: string | null }) {
  return `${row.name} (${row.slug}); order ${row.sortOrder}; ${row.isActive ? "shown" : "hidden"}; ${row.accent}/${row.surface}; ${row.delivery}${row.logoUrl ? "; logo" : ""}`;
}

/** Create (no id) or edit a group. */
export async function saveGroup(actor: Actor, raw: Record<string, unknown>, groupId?: number | null): Promise<{ ok: true; id: number } | Fail> {
  if (!hasPermission(actor.role, "catalogue")) return { ok: false, status: 403, error: "إدارة المجموعات تحتاج صلاحية الكتالوج." };

  const current = groupId ? await db.orm.public.PackageGroup.first({ id: groupId }) : null;

  if (groupId && !current) return { ok: false, status: 404, error: "المجموعة غير موجودة." };

  const builtIn = current ? isBuiltInGroup(current.slug) : false;
  // A built-in group keeps its identity: only its name, text, logo, order, visibility and colours change.
  const parsed = parseGroup(builtIn && current ? { ...raw, slug: current.slug, delivery: current.delivery } : raw);

  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const input = parsed.value;

  if (!builtIn && isBuiltInGroup(input.slug)) return { ok: false, status: 400, error: "هذا الرابط محجوز لمجموعة أساسية." };

  const clash = await db.orm.public.PackageGroup.first({ slug: input.slug });

  if (clash && clash.id !== groupId) return { ok: false, status: 409, error: "فيه مجموعة ثانية بنفس الرابط المختصر." };

  const now = new Date().toISOString();
  const fields = { ...input, updatedAt: now };
  let id: number;

  if (current) {
    await db.orm.public.PackageGroup.where({ id: current.id }).update(fields);
    id = current.id;
  } else {
    // New groups are digital platforms; IPTV and VIP are the built-in ones.
    id = (await db.orm.public.PackageGroup.create({ ...fields, serviceType: "DIGITAL" })).id;
  }

  await logActivity({
    actor,
    entityType: "PACKAGE",
    entityId: null,
    action: current ? "GROUP_UPDATED" : "GROUP_CREATED",
    summary: `${current ? "تعديل" : "إضافة"} مجموعة باقات: ${input.name}`,
    details: `group ${id}: ${current ? describe(current) : "—"} → ${describe(input)}`,
  });

  return { ok: true, id };
}

/** The group a package should be in, checked against the package's service (never mixed). */
export async function groupForPackage(groupId: unknown, serviceType: "IPTV" | "VIP" | "DIGITAL"): Promise<{ ok: true; id: number | null } | Fail> {
  if (groupId === undefined) return { ok: true, id: null };

  const id = Number(groupId);

  if (groupId === null || groupId === "" || !Number.isInteger(id) || id <= 0) {
    return serviceType === "DIGITAL" ? { ok: false, status: 400, error: "باقة المنصة لازم تكون ضمن مجموعة." } : { ok: true, id: null };
  }

  const group = await db.orm.public.PackageGroup.first({ id });

  if (!group) return { ok: false, status: 404, error: "المجموعة غير موجودة." };
  if (String(group.serviceType).toUpperCase() !== serviceType) return { ok: false, status: 400, error: "المجموعة لازم تكون من نفس نوع الخدمة (IPTV وVIP والمنصات ما تختلط)." };

  return { ok: true, id };
}
