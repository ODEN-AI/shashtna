import { NextResponse } from "next/server";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";
import {
  getSupportTicket,
  makeSupportMessageId,
  saveSupportTicket,
} from "@/src/lib/support-store";
import { requireUser } from "@/src/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureDatabaseConnection();

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const auth = requireUser(request, searchParams.get("userId"));

    if (!auth.ok) {
      return auth.response;
    }

    const userId = auth.userId;

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "معرف المستخدم غير صحيح.",
        },
        { status: 400 },
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

    if (ticket.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          message: "ليس لديك صلاحية الوصول إلى هذه التذكرة.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        ticket,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/support/tickets/[id] error:", error);

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
    const auth = requireUser(request, body.userId);

    if (!auth.ok) {
      return auth.response;
    }

    const userId = auth.userId;
    const action = String(body.action ?? "REPLY")
      .trim()
      .toUpperCase();
    const message = String(body.message ?? "").trim();

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "معرف المستخدم غير صحيح.",
        },
        { status: 400 },
      );
    }

    const user = await db.orm.public.User.first({
      id: userId,
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "المستخدم غير موجود.",
        },
        { status: 404 },
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

    if (ticket.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          message: "ليس لديك صلاحية تعديل هذه التذكرة.",
        },
        { status: 403 },
      );
    }

    if (action === "CLOSE") {
      ticket.status = "CLOSED";
      ticket.updatedAt = new Date().toISOString();
      await saveSupportTicket(ticket);

      return NextResponse.json({
        success: true,
        ticket,
      });
    }

    if (ticket.status === "CLOSED") {
      ticket.status = "OPEN";
    }

    if (message.length < 2) {
      return NextResponse.json(
        {
          success: false,
          message: "اكتب الرد أولًا.",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    ticket.messages.push({
      id: makeSupportMessageId(),
      sender: "CUSTOMER",
      senderName: user.name,
      message,
      createdAt: now,
    });

    ticket.lastSender = "CUSTOMER";
    ticket.updatedAt = now;
    ticket.status = "OPEN";

    await saveSupportTicket(ticket);

    return NextResponse.json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error("POST /api/support/tickets/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر تحديث التذكرة.",
      },
      { status: 500 },
    );
  }
}
