import { NextResponse } from "next/server";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";
import {
  getAllSupportTickets,
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

export async function GET(request: Request) {
  try {
    await ensureDatabaseConnection();

    const { searchParams } = new URL(request.url);
    const adminUserId = Number(searchParams.get("adminUserId"));
    const requestedStatus = String(
      searchParams.get("status") ?? "ALL",
    ).toUpperCase();

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

    const tickets = await getAllSupportTickets();
    const filtered =
      requestedStatus === "ALL"
        ? tickets
        : tickets.filter(
            (ticket) => ticket.status === requestedStatus,
          );

    return NextResponse.json(
      {
        success: true,
        tickets: filtered,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/admin/support/tickets error:", error);

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
