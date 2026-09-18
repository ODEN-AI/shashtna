import {
  GET as baseGET,
  POST as basePOST,
} from "@/app/api/support/tickets/route";
import { requireMobileAuth } from "@/src/lib/mobile-auth";

export async function GET(request: Request) {
  const auth = requireMobileAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  url.searchParams.set("userId", String(auth.userId));

  return baseGET(
    new Request(url.toString(), {
      method: "GET",
      headers: request.headers,
    }),
  );
}

export async function POST(request: Request) {
  const auth = requireMobileAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json();
  body.userId = auth.userId;

  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  headers.delete("Content-Length");

  return basePOST(
    new Request(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}
