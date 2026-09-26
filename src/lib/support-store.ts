import { getStore } from "@netlify/blobs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BLOB_STORES, blobStoreName } from "@/src/lib/blob-stores";
import { shouldUseBlobStorage as isBlobStorage } from "@/src/lib/runtime";

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
  /** What the ticket is about, when opened from a subscription, order,
   * app or device. Absent on tickets created before the redesign. */
  context?: SupportTicketContext;
};

export type SupportTicketContext = {
  subscriptionId?: number;
  orderId?: number;
  app?: string;
  device?: string;
  topic?: string;
  /** Non-sensitive facts from the mobile app (network type, last app
   * error), to help staff reproduce a problem. */
  diagnostics?: string;
};

// Namespaced per deploy (SHASHTNA_BLOB_NAMESPACE); no fallback to the
// shared store, so a test deploy never lists or edits production tickets.
const STORE_NAME = BLOB_STORES.support;
const LOCAL_DIR = path.join(process.cwd(), ".data");
const LOCAL_FILE = path.join(LOCAL_DIR, "support-tickets.json");

// Netlify Blobs on Netlify (read-only function filesystem); a local JSON file
// in development or a local production build. See src/lib/runtime.ts.
function shouldUseNetlifyBlobs() {
  return isBlobStorage();
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
  if (!shouldUseNetlifyBlobs()) {
    const tickets = await readLocalTickets();
    return tickets.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime(),
    );
  }

  const store = getStore({
    name: blobStoreName(STORE_NAME),
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
  if (!shouldUseNetlifyBlobs()) {
    const tickets = await readLocalTickets();
    return tickets.find((ticket) => ticket.id === id) ?? null;
  }

  const store = getStore({
    name: blobStoreName(STORE_NAME),
    consistency: "strong",
  });

  const ticket = await store.get(ticketKey(id), {
    type: "json",
    consistency: "strong",
  });

  return (ticket as SupportTicket | null) ?? null;
}

export async function saveSupportTicket(ticket: SupportTicket) {
  if (!shouldUseNetlifyBlobs()) {
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
    name: blobStoreName(STORE_NAME),
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
    category === "device" ||
    category === "app" ||
    category === "playback" ||
    category === "payment"
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
