import { NextResponse } from "next/server";
import { ensureDatabaseConnection } from "@/src/prisma/db";
import {
  getAllSupportTickets,
} from "@/src/lib/support-store";
import { requireAdmin } from "@/src/lib/session";

export const dynamic = "force-dynamic";

async function getAdminUser(request: Request) {
  const admin = await requireAdmin(request);

  return admin.ok ? admin.user : null;
}

export async function GET(request: Request) {
  try {
    await ensureDatabaseConnection();

    const { searchParams } = new URL(request.url);
    const requestedStatus = String(
      searchParams.get("status") ?? "ALL",
    ).toUpperCase();

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
