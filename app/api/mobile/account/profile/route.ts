import { PUT as basePUT } from "@/app/api/account/profile/route";
import { requireMobileSession } from "@/src/server/mobile/http";

export async function PUT(request: Request) {
  const auth = await requireMobileSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json();
  body.userId = auth.userId;

  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  headers.delete("Content-Length");

  return basePUT(
    new Request(request.url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    }),
  );
}
