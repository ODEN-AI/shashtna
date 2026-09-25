"use server";

import { db } from "@/src/prisma/db";
import { toDate } from "@/src/lib/i18n";
import { getSessionUser } from "@/src/server/auth";
import { logActivity } from "@/src/server/activity";

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

/** Saves a Shashtna Digital project request so no lead is lost. */
export async function submitServiceLead(input: {
  name: string;
  phone: string;
  projectType: string;
  budget: string;
  timeline: string;
  details: string;
}) {
  const name = text(input.name, 120);
  const phone = text(input.phone, 40);
  const details = text(input.details, 4000);

  if (name.length < 2 || phone.replace(/\D/g, "").length < 7) {
    return { ok: false as const, error: "اكتب الاسم ورقم تواصل صحيح." };
  }

  const user = await getSessionUser().catch(() => null);

  // Ignore an identical request submitted again within ten minutes.
  const recent = await db.orm.public.ServiceLead.where({ phone, projectType: text(input.projectType, 80) })
    .orderBy((lead) => lead.id.desc())
    .first();

  if (recent && Date.now() - (toDate(recent.createdAt)?.getTime() ?? 0) < 10 * 60 * 1000) {
    return { ok: true as const, id: recent.id };
  }

  const lead = await db.orm.public.ServiceLead.create({
    userId: user?.id ?? null,
    name,
    phone,
    projectType: text(input.projectType, 80),
    budget: text(input.budget, 80) || null,
    timeline: text(input.timeline, 120) || null,
    details: details || "—",
  });

  await logActivity({
    userId: user?.id ?? null,
    entityType: "LEAD",
    entityId: lead.id,
    action: "LEAD_CREATED",
    summary: `طلب مشروع جديد من ${name} (${lead.projectType})`,
  });

  return { ok: true as const, id: lead.id };
}
