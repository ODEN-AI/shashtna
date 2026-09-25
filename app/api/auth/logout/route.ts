import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/src/lib/session";

export async function POST() {
  const response = NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );

  clearSessionCookie(response);

  return response;
}
