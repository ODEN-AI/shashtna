import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  verifyAuthToken,
} from "@/src/lib/mobile-auth";

// Server-side gate for every /admin page. The admin APIs re-check the role
// against the database on each request.
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? verifyAuthToken(token) : null;

  if (!session) {
    redirect("/login?redirect=/admin");
  }

  if (String(session.role ?? "").toUpperCase() !== "ADMIN") {
    redirect("/dashboard");
  }

  return children;
}
