import { NextResponse } from "next/server";
import { ensureDatabaseConnection } from "@/src/prisma/db";
import {
  getSupportTicket,
  makeSupportMessageId,
  normalizeSupportStatus,
  saveSupportTicket,
} from "@/src/lib/support-store";
import { requireAdmin } from "@/src/lib/session";

export const dynamic = "force-dynamic";

async function getAdminUser(request: Request) {
  const admin = await requireAdmin(request);

  return admin.ok ? admin.user : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureDatabaseConnection();

    const { id } = await params;

    const admin = await getAdminUser(request);

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "غير مصرح.",
        },
        { status: 403 },
      );
    }

    const ticket = await getSupportTicket(id);

    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          message: "التذكرة غير موجودة.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error("GET /api/admin/support/tickets/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر فتح التذكرة.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureDatabaseConnection();

    const { id } = await params;
    const body = await request.json();
    const message = String(body.message ?? "").trim();
    const requestedStatus = body.status ?? null;

    const admin = await getAdminUser(request);

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "غير مصرح.",
        },
        { status: 403 },
      );
    }

    const ticket = await getSupportTicket(id);

    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          message: "التذكرة غير موجودة.",
        },
        { status: 404 },
      );
    }

    if (requestedStatus !== null) {
      ticket.status = normalizeSupportStatus(requestedStatus);
    }

    if (message) {
      const now = new Date().toISOString();

      ticket.messages.push({
        id: makeSupportMessageId(),
        sender: "ADMIN",
        senderName: admin.name,
        message,
        createdAt: now,
      });

      ticket.lastSender = "ADMIN";
      ticket.updatedAt = now;

      if (ticket.status === "OPEN") {
        ticket.status = "IN_PROGRESS";
      }
    } else {
      ticket.updatedAt = new Date().toISOString();
    }

    await saveSupportTicket(ticket);

    return NextResponse.json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error("POST /api/admin/support/tickets/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر تحديث التذكرة.",
      },
      { status: 500 },
    );
  }
}
