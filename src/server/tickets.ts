import {
  getAllSupportTickets,
  getSupportTicket,
  makeSupportMessageId,
  makeSupportTicketId,
  normalizeSupportCategory,
  saveSupportTicket,
  type SupportTicket,
  type SupportTicketContext,
} from "@/src/lib/support-store";
import { logActivity } from "@/src/server/activity";

type Customer = { id: number; name: string; phone: string };

export async function listTicketsForUser(userId: number) {
  const tickets = await getAllSupportTickets();

  return tickets.filter((ticket) => ticket.userId === userId);
}

export async function getTicketForUser(userId: number, ticketId: string) {
  const ticket = await getSupportTicket(ticketId);

  return ticket && ticket.userId === userId ? ticket : null;
}

function cleanContext(context: SupportTicketContext): SupportTicketContext | undefined {
  const result: SupportTicketContext = {};

  if (Number.isInteger(context.subscriptionId) && context.subscriptionId! > 0) {
    result.subscriptionId = context.subscriptionId;
  }

  if (Number.isInteger(context.orderId) && context.orderId! > 0) {
    result.orderId = context.orderId;
  }

  for (const key of ["app", "device", "topic"] as const) {
    const value = String(context[key] ?? "").trim().slice(0, 80);

    if (value) {
      result[key] = value;
    }
  }

  const diagnostics = String(context.diagnostics ?? "").trim().slice(0, 400);

  if (diagnostics) {
    result.diagnostics = diagnostics;
  }

  return Object.keys(result).length ? result : undefined;
}

export async function createTicket(
  user: Customer,
  input: { subject: string; category: string; message: string; context?: SupportTicketContext },
) {
  const subject = input.subject.trim();
  const message = input.message.trim();

  if (!subject || subject.length > 120) {
    return { ok: false as const, error: "اكتب عنوانًا واضحًا للتذكرة (حتى 120 حرفًا)." };
  }

  if (message.length < 5) {
    return { ok: false as const, error: "اكتب تفاصيل المشكلة بشكل أوضح." };
  }

  if (message.length > 4000) {
    return { ok: false as const, error: "الرسالة طويلة جدًا." };
  }

  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: makeSupportTicketId(),
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    subject,
    category: normalizeSupportCategory(input.category),
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
    lastSender: "CUSTOMER",
    messages: [
      {
        id: makeSupportMessageId(),
        sender: "CUSTOMER",
        senderName: user.name,
        message,
        createdAt: now,
      },
    ],
    context: input.context ? cleanContext(input.context) : undefined,
  };

  await saveSupportTicket(ticket);

  await logActivity({
    actor: { id: user.id, role: "CUSTOMER" },
    userId: user.id,
    entityType: "TICKET",
    entityId: ticket.id,
    action: "TICKET_CREATED",
    summary: `تم فتح تذكرة دعم «${subject}»`,
    customerVisible: true,
  });

  return { ok: true as const, ticket };
}

export async function replyToTicket(user: Customer, ticketId: string, message: string) {
  const ticket = await getTicketForUser(user.id, ticketId);
  const text = message.trim();

  if (!ticket) {
    return { ok: false as const, error: "التذكرة غير موجودة." };
  }

  if (text.length < 2 || text.length > 4000) {
    return { ok: false as const, error: "اكتب الرد أولًا." };
  }

  const now = new Date().toISOString();

  ticket.messages.push({
    id: makeSupportMessageId(),
    sender: "CUSTOMER",
    senderName: user.name,
    message: text,
    createdAt: now,
  });
  ticket.lastSender = "CUSTOMER";
  ticket.updatedAt = now;
  ticket.status = "OPEN";

  await saveSupportTicket(ticket);

  return { ok: true as const };
}

export async function closeTicket(user: Customer, ticketId: string) {
  const ticket = await getTicketForUser(user.id, ticketId);

  if (!ticket) {
    return { ok: false as const, error: "التذكرة غير موجودة." };
  }

  ticket.status = "CLOSED";
  ticket.updatedAt = new Date().toISOString();
  await saveSupportTicket(ticket);

  return { ok: true as const };
}

export const TICKET_CATEGORIES = [
  { value: "subscription", ar: "الاشتراك", en: "Subscription" },
  { value: "playback", ar: "التشغيل والبث", en: "Playback" },
  { value: "app", ar: "التطبيق", en: "App" },
  { value: "device", ar: "الجهاز", en: "Device" },
  { value: "payment", ar: "الدفع والطلبات", en: "Payment & orders" },
  { value: "general", ar: "عام", en: "General" },
] as const;

export const TICKET_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  OPEN: { ar: "مفتوحة", en: "Open" },
  IN_PROGRESS: { ar: "قيد المعالجة", en: "In progress" },
  CLOSED: { ar: "مغلقة", en: "Closed" },
};
