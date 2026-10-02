import { claimsOtherUser, fail, FORBIDDEN_MESSAGE, ok, readJson, withMobileUser } from "@/src/server/mobile/http";
import { shapeTicket } from "@/src/server/mobile/shape";
import { closeTicket, getTicketForUser, replyToTicket } from "@/src/server/tickets";

export const dynamic = "force-dynamic";

const NOT_FOUND = "التذكرة غير موجودة.";

/** One of the customer's tickets with its conversation (another customer's id answers 404). */
export const GET = withMobileUser<{ id: string }>(async ({ request, user, params }) => {
  if (claimsOtherUser(new URL(request.url).searchParams.get("userId"), user.id)) {
    return fail(403, "FORBIDDEN", FORBIDDEN_MESSAGE);
  }

  const ticket = await getTicketForUser(user.id, params.id);

  return ticket ? ok({ ticket: shapeTicket(ticket) }) : fail(404, "NOT_FOUND", NOT_FOUND);
});

/** Reply (`{ message }`, older builds `{ action: "REPLY", message }`) or close (`{ action: "close" | "CLOSE" }`). */
export const POST = withMobileUser<{ id: string }>(async ({ request, user, params }) => {
  const body = await readJson(request);

  if (claimsOtherUser(body.userId, user.id)) {
    return fail(403, "FORBIDDEN", FORBIDDEN_MESSAGE);
  }

  const action = String(body.action ?? "REPLY").toUpperCase();
  const result = action === "CLOSE" ? await closeTicket(user, params.id) : await replyToTicket(user, params.id, String(body.message ?? ""));

  if (!result.ok) {
    return result.error === NOT_FOUND ? fail(404, "NOT_FOUND", NOT_FOUND) : fail(400, "VALIDATION", result.error);
  }

  const ticket = await getTicketForUser(user.id, params.id);

  return ticket ? ok({ ticket: shapeTicket(ticket) }) : fail(404, "NOT_FOUND", NOT_FOUND);
});
