import { claimsOtherUser, fail, FORBIDDEN_MESSAGE, ok, positiveInt, readJson, withMobileUser } from "@/src/server/mobile/http";
import { shapeTicket } from "@/src/server/mobile/shape";
import { createTicket, listTicketsForUser } from "@/src/server/tickets";

export const dynamic = "force-dynamic";

/** The customer's tickets — the same records Admin → Support answers. Newest activity first. */
export const GET = withMobileUser(async ({ request, user }) => {
  if (claimsOtherUser(new URL(request.url).searchParams.get("userId"), user.id)) {
    return fail(403, "FORBIDDEN", FORBIDDEN_MESSAGE);
  }

  const tickets = (await listTicketsForUser(user.id)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  return ok({ tickets: tickets.map(shapeTicket) });
});

/** Opens a ticket (optionally about an order/subscription; app diagnostics become the ticket context). */
export const POST = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);

  if (claimsOtherUser(body.userId, user.id)) {
    return fail(403, "FORBIDDEN", FORBIDDEN_MESSAGE);
  }

  const diagnostics = body.diagnostics && typeof body.diagnostics === "object" ? (body.diagnostics as Record<string, unknown>) : null;
  const result = await createTicket(user, {
    subject: String(body.subject ?? ""),
    category: String(body.category ?? ""),
    message: String(body.message ?? ""),
    context: {
      orderId: positiveInt(body.orderId) ?? undefined,
      subscriptionId: positiveInt(body.subscriptionId) ?? undefined,
      app: diagnostics ? `Shashtna app ${String(diagnostics.appVersion ?? "").slice(0, 20)} · ${String(diagnostics.os ?? "").slice(0, 30)}` : undefined,
      device: diagnostics?.device ? String(diagnostics.device) : undefined,
    },
  });

  if (!result.ok) return fail(400, "VALIDATION", result.error);

  return ok({ ticket: shapeTicket(result.ticket) }, { status: 201 });
});
