import { NextResponse } from "next/server";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";
import {
  getSupportTicket,
  makeSupportMessageId,
  normalizeSupportStatus,
  saveSupportTicket,
} from "@/src/lib/support-store";

export const dynamic = "force-dynamic";

async function getAdminUser(userId: number) {
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const user = await db.orm.public.User.first({
    id: userId,
  });

  if (!user || String(user.role ?? "").toUpperCase() !== "ADMIN") {
    return null;
  }

  return user;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureDatabaseConnection();

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const adminUserId = Number(searchParams.get("adminUserId"));

    const admin = await getAdminUser(adminUserId);

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
    const adminUserId = Number(body.adminUserId);
    const message = String(body.message ?? "").trim();
    const requestedStatus = body.status ?? null;

    const admin = await getAdminUser(adminUserId);

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
