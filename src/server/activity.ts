import { db } from "@/src/prisma/db";

export type EntityType =
  | "ORDER"
  | "SUBSCRIPTION"
  | "TICKET"
  | "PACKAGE"
  | "DEVICE"
  | "APP"
  | "ANNOUNCEMENT"
  | "INCIDENT"
  | "SETTING"
  | "STAFF"
  | "USER"
  | "LEAD"
  | "PASSWORD_RESET"
  | "NOTIFICATION";

export type ActivityInput = {
  actor?: { id: number; role?: string | null } | null;
  userId?: number | null;
  entityType: EntityType;
  entityId?: string | number | null;
  action: string;
  summary: string;
  details?: string | null;
  customerVisible?: boolean;
};

/**
 * Records one event in the activity log. Logging must never break the
 * operation it describes, so failures are reported and swallowed.
 */
export async function logActivity(input: ActivityInput) {
  try {
    await db.orm.public.ActivityEvent.create({
      actorUserId: input.actor?.id ?? null,
      actorRole: input.actor?.role ?? null,
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId:
        input.entityId === null || input.entityId === undefined
          ? null
          : String(input.entityId),
      action: input.action,
      summary: input.summary,
      details: input.details ?? null,
      customerVisible: input.customerVisible ?? false,
    });
  } catch (error) {
    console.error("ACTIVITY_LOG_ERROR:", error);
  }
}

export async function listCustomerActivity(userId: number, limit = 10) {
  return db.orm.public.ActivityEvent.where({ userId, customerVisible: true })
    .orderBy((event) => event.createdAt.desc())
    .limit(limit)
    .all();
}

export async function listEntityActivity(
  entityType: EntityType,
  entityId: string | number,
  options: { customerVisibleOnly?: boolean } = {},
) {
  const events = await db.orm.public.ActivityEvent.where({
    entityType,
    entityId: String(entityId),
  })
    .orderBy((event) => event.createdAt.asc())
    .all();

  return options.customerVisibleOnly
    ? events.filter((event) => event.customerVisible)
    : events;
}
