import { checkPlaybookEntry, searchPlaybook, type PlaybookRow } from "@/src/lib/playbook";
import { isFullAccess } from "@/src/lib/system";
import { db } from "@/src/prisma/db";
import { logActivity } from "@/src/server/activity";

/**
 * The owner's playbook — database side. Reading is open to the server (the
 * AI tools and the admin page); writing is owner/admin only and audited
 * (PLAYBOOK_CREATED / PLAYBOOK_UPDATED). Entries are never deleted: they are
 * switched off and kept. See docs/playbook.md.
 */

type Actor = { id: number; role: string };
type Fail = { ok: false; status: number; error: string };

const toRow = (row: { id: number; kind: string; service: string; title: string; keywords: string; content: string; isActive: boolean; sortOrder: number; updatedAt: unknown }) => ({
  id: row.id,
  kind: row.kind,
  service: row.service,
  title: row.title,
  keywords: row.keywords,
  content: row.content,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  updatedAt: String(row.updatedAt),
});

export type PlaybookEntryView = ReturnType<typeof toRow>;

/** Every entry (admin page), active first, then by order. */
export async function listPlaybook(): Promise<PlaybookEntryView[]> {
  const rows = await db.orm.public.PlaybookEntry.orderBy([(e) => e.sortOrder.asc(), (e) => e.id.asc()]).all();

  return rows.map(toRow).sort((a, b) => Number(b.isActive) - Number(a.isActive));
}

/** Active entries matching a question (the AI tool). */
export async function findPlaybook(query: string, options: { service?: string | null; kind?: string | null; limit?: number } = {}): Promise<PlaybookRow[]> {
  const rows = await db.orm.public.PlaybookEntry.where({ isActive: true }).all();

  return searchPlaybook(rows.map(toRow), query, options);
}

export async function savePlaybookEntry(actor: Actor, id: number | null, input: Record<string, unknown>): Promise<{ ok: true; id: number } | Fail> {
  if (!isFullAccess(actor.role)) return { ok: false, status: 403, error: "دليل الحلول يعدّله المالك بس." };

  const checked = checkPlaybookEntry(input);

  if (!checked.ok) return { ok: false, status: 400, error: checked.error };

  const value = checked.value;

  if (id === null) {
    const created = await db.orm.public.PlaybookEntry.create({ ...value, updatedBy: actor.id });

    await logActivity({ actor, entityType: "SETTING", entityId: created.id, action: "PLAYBOOK_CREATED", summary: `إضافة لدليل الحلول: ${value.title}`, details: JSON.stringify({ kind: value.kind, service: value.service, active: value.isActive }) });

    return { ok: true, id: created.id };
  }

  if (!Number.isInteger(id) || id <= 0) return { ok: false, status: 400, error: "طلب غير صالح." };

  const existing = await db.orm.public.PlaybookEntry.first({ id });

  if (!existing) return { ok: false, status: 404, error: "العنصر غير موجود." };

  await db.orm.public.PlaybookEntry.where({ id }).update({ ...value, updatedBy: actor.id });
  await logActivity({
    actor,
    entityType: "SETTING",
    entityId: id,
    action: "PLAYBOOK_UPDATED",
    summary: `تعديل بدليل الحلول: ${value.title}${existing.isActive !== value.isActive ? (value.isActive ? " (تفعيل)" : " (إيقاف)") : ""}`,
    details: JSON.stringify({ kind: value.kind, service: value.service, active: value.isActive, contentChanged: existing.content !== value.content }),
  });

  return { ok: true, id };
}
