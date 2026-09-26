import { createTicket, listTicketsForUser } from "@/src/server/tickets";
import { shapeTicket } from "@/src/server/mobile";
import { fail, ok, positiveInt, readJson, withMobileUser } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

export const GET = withMobileUser(async ({ user }) => {
  const tickets = await listTicketsForUser(user.id);

  return ok({
    tickets: tickets
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((ticket) => shapeTicket(ticket)),
  });
});

/**
 * New ticket through the website's ticket service. `diagnostics` are a few
 * non-sensitive facts from the app (version, OS, device model) added to the
 * ticket context so staff can help faster.
 */
export const POST = withMobileUser(async ({ request, user }) => {
  const body = await readJson(request);
  const diagnostics = body.diagnostics && typeof body.diagnostics === "object" ? (body.diagnostics as Record<string, unknown>) : {};
  const app = [diagnostics.appVersion, diagnostics.os].filter((value) => typeof value === "string" && value).join(" · ");

  const result = await createTicket(user, {
    subject: String(body.subject ?? ""),
    category: String(body.category ?? "general"),
    message: String(body.message ?? ""),
    context: {
      orderId: positiveInt(body.orderId) ?? undefined,
      subscriptionId: positiveInt(body.subscriptionId) ?? undefined,
      app: app ? `Shashtna Mobile ${app}`.slice(0, 80) : "Shashtna Mobile",
      device: typeof diagnostics.device === "string" ? diagnostics.device.slice(0, 80) : undefined,
    },
  });

  return result.ok ? ok({ ticket: shapeTicket(result.ticket, true) }, { status: 201 }) : fail(400, "VALIDATION", result.error);
});
