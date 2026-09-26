import { closeTicket, getTicketForUser, replyToTicket } from "@/src/server/tickets";
import { fail, ok, readJson, withMobileUser } from "@/src/server/mobile-api";
import { shapeTicket } from "@/src/server/mobile";

export const dynamic = "force-dynamic";

export const GET = withMobileUser<{ id: string }>(async ({ user, params }) => {
  const ticket = await getTicketForUser(user.id, decodeURIComponent(params.id));

  return ticket ? ok({ ticket: shapeTicket(ticket, true) }) : fail(404, "NOT_FOUND", "التذكرة غير موجودة.");
});

/** `{ message }` adds a reply; `{ action: "close" }` closes the ticket. */
export const POST = withMobileUser<{ id: string }>(async ({ request, user, params }) => {
  const id = decodeURIComponent(params.id);
  const body = await readJson(request);
  const result =
    body.action === "close" ? await closeTicket(user, id) : await replyToTicket(user, id, String(body.message ?? ""));

  if (!result.ok) {
    return fail(400, "VALIDATION", result.error);
  }

  const ticket = await getTicketForUser(user.id, id);

  return ticket ? ok({ ticket: shapeTicket(ticket, true) }) : fail(404, "NOT_FOUND", "التذكرة غير موجودة.");
});
