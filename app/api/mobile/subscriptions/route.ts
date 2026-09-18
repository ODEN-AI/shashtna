import { GET as baseGET } from "@/app/api/subscriptions/route";
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
