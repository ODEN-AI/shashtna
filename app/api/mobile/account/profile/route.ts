import { PUT as basePUT } from "@/app/api/account/profile/route";
import { requireMobileAuth } from "@/src/lib/mobile-auth";

export async function PUT(request: Request) {
  const auth = requireMobileAuth(request);

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
