import { GET as baseGET } from "@/app/api/receipts/route";
import { requireMobileSession } from "@/src/server/mobile/http";

export async function GET(request: Request) {
  const auth = await requireMobileSession(request);

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
