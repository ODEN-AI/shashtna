import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, verifyAuthToken } from "@/src/lib/mobile-auth";
import {
  hasPermission,
  isStaffRole,
  normalizeRole,
  type Permission,
} from "@/src/lib/roles";
import { db } from "@/src/prisma/db";
import { sessionIsCurrent } from "@/src/server/sessions";

export type SessionUser = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  isStaff: boolean;
  preferredContact: string | null;
  renewalReminders: boolean;
  marketingOptIn: boolean;
  createdAt: string;
};

/**
 * The signed-in user for the current request (server components and server
 * actions). The account is re-read from the database, so a deleted account
 * or a changed role takes effect immediately. Memoised per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload) {
    return null;
  }

  const user = await db.orm.public.User.first({ id: payload.sub });

  // Deleted accounts and revoked sessions (password changed elsewhere,
  // "sign out everywhere") end here.
  if (!user || !sessionIsCurrent(payload, user)) {
    return null;
  }

  const role = normalizeRole(user.role) || "CUSTOMER";

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role,
    isStaff: isStaffRole(role),
    preferredContact: user.preferredContact,
    renewalReminders: user.renewalReminders,
    marketingOptIn: user.marketingOptIn,
    createdAt: String(user.createdAt),
  };
});

function loginUrl(returnTo: string) {
  return `/login?redirect=${encodeURIComponent(returnTo)}`;
}

/** For customer pages: redirects to login when there is no session. */
export async function requireCustomer(returnTo: string) {
  const user = await getSessionUser();

  if (!user) {
    redirect(loginUrl(returnTo));
  }

  return user;
}

/**
 * For admin pages. Redirects visitors without a session to login and
 * customers to their dashboard. Staff without the permission get
 * `allowed: false` so the page can render an "unauthorized" state.
 */
export async function requireStaffPage(
  returnTo: string,
  permission?: Permission,
) {
  const user = await getSessionUser();

  if (!user) {
    redirect(loginUrl(returnTo));
  }

  if (!user.isStaff) {
    redirect("/dashboard");
  }

  return {
    user,
    allowed: permission ? hasPermission(user.role, permission) : true,
  };
}

/** For server actions: throws instead of redirecting. */
export async function assertCustomer() {
  const user = await getSessionUser();

  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  return user;
}

export async function assertStaff(permission: Permission) {
  const user = await getSessionUser();

  if (!user || !hasPermission(user.role, permission)) {
    throw new Error("FORBIDDEN");
  }

  return user;
}
