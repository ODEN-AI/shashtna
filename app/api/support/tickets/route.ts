import { NextResponse } from "next/server";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";
import {
  getAllSupportTickets,
  makeSupportMessageId,
  makeSupportTicketId,
  normalizeSupportCategory,
  saveSupportTicket,
  type SupportTicket,
} from "@/src/lib/support-store";

export const dynamic = "force-dynamic";

function serializeTicket(ticket: SupportTicket) {
  return {
    ...ticket,
    messages: ticket.messages,
  };
}

export async function GET(request: Request) {
  try {
    await ensureDatabaseConnection();

    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get("userId"));

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

    const tickets = await getAllSupportTickets();
    const userTickets = tickets
      .filter((ticket) => ticket.userId === userId)
      .map(serializeTicket);

    return NextResponse.json(
      {
        success: true,
        tickets: userTickets,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/support/tickets error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر تحميل تذاكر الدعم.",
        tickets: [],
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseConnection();

    const body = await request.json();
    const userId = Number(body.userId);
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();
    const category = normalizeSupportCategory(body.category);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "بيانات المستخدم غير صحيحة.",
        },
        { status: 400 },
      );
    }

    if (!subject) {
      return NextResponse.json(
        {
          success: false,
          message: "عنوان التذكرة مطلوب.",
        },
        { status: 400 },
      );
    }

    if (subject.length > 120) {
      return NextResponse.json(
        {
          success: false,
          message: "عنوان التذكرة طويل جدًا.",
        },
        { status: 400 },
      );
    }

    if (message.length < 5) {
      return NextResponse.json(
        {
          success: false,
          message: "اكتب تفاصيل المشكلة بشكل أوضح.",
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

    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      id: makeSupportTicketId(),
      userId,
      userName: user.name,
      userPhone: user.phone,
      subject,
      category,
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
    };

    await saveSupportTicket(ticket);

    return NextResponse.json(
      {
        success: true,
        ticket,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/support/tickets error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر إنشاء تذكرة الدعم.",
      },
      { status: 500 },
    );
  }
}
