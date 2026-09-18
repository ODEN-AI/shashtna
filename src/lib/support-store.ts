import { getStore } from "@netlify/blobs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type SupportTicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "CLOSED";

export type SupportMessage = {
  id: string;
  sender: "CUSTOMER" | "ADMIN";
  senderName: string | null;
  message: string;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  userId: number;
  userName: string;
  userPhone: string;
  subject: string;
  category: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  lastSender: "CUSTOMER" | "ADMIN";
  messages: SupportMessage[];
};

const STORE_NAME = "shashtna-support";
const LOCAL_DIR = path.join(process.cwd(), ".data");
const LOCAL_FILE = path.join(LOCAL_DIR, "support-tickets.json");

function useNetlifyBlobs() {
  return String(process.env.NETLIFY ?? "").toLowerCase() === "true";
}

function ticketKey(id: string) {
  return `tickets/${id}.json`;
}

async function readLocalTickets(): Promise<SupportTicket[]> {
  try {
    const raw = await readFile(LOCAL_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalTickets(tickets: SupportTicket[]) {
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(
    LOCAL_FILE,
    JSON.stringify(tickets, null, 2),
    "utf8",
  );
}

export async function getAllSupportTickets(): Promise<SupportTicket[]> {
  if (!useNetlifyBlobs()) {
    const tickets = await readLocalTickets();
    return tickets.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime(),
    );
  }

  const store = getStore({
    name: STORE_NAME,
    consistency: "strong",
  });

  const { blobs } = await store.list({
    prefix: "tickets/",
  });

  const results = await Promise.all(
    blobs.map(async ({ key }) => {
      const ticket = await store.get(key, {
        type: "json",
        consistency: "strong",
      });

      return ticket as SupportTicket | null;
    }),
  );

  return results
    .filter((ticket): ticket is SupportTicket => Boolean(ticket))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime(),
    );
}

export async function getSupportTicket(
  id: string,
): Promise<SupportTicket | null> {
  if (!useNetlifyBlobs()) {
    const tickets = await readLocalTickets();
    return tickets.find((ticket) => ticket.id === id) ?? null;
  }

  const store = getStore({
    name: STORE_NAME,
    consistency: "strong",
  });

  const ticket = await store.get(ticketKey(id), {
    type: "json",
    consistency: "strong",
  });

  return (ticket as SupportTicket | null) ?? null;
}

export async function saveSupportTicket(ticket: SupportTicket) {
  if (!useNetlifyBlobs()) {
    const tickets = await readLocalTickets();
    const index = tickets.findIndex((item) => item.id === ticket.id);

    if (index === -1) {
      tickets.push(ticket);
    } else {
      tickets[index] = ticket;
    }

    await writeLocalTickets(tickets);
    return;
  }

  const store = getStore({
    name: STORE_NAME,
    consistency: "strong",
  });

  await store.setJSON(ticketKey(ticket.id), ticket);
}

export function makeSupportTicketId() {
  return `ST-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomUUID()
    .slice(0, 8)
    .toUpperCase()}`;
}

export function makeSupportMessageId() {
  return `MSG-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomUUID()
    .slice(0, 8)
    .toUpperCase()}`;
}

export function normalizeSupportCategory(value: unknown) {
  const category = String(value ?? "general")
    .trim()
    .toLowerCase();

  if (
    category === "subscription" ||
    category === "device"
  ) {
    return category;
  }

  return "general";
}

export function normalizeSupportStatus(
  value: unknown,
): SupportTicketStatus {
  const status = String(value ?? "OPEN")
    .trim()
    .toUpperCase();

  if (status === "IN_PROGRESS" || status === "CLOSED") {
    return status;
  }

  return "OPEN";
}
