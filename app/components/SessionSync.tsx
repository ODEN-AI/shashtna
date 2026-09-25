"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Pages that cannot work without a valid server session.
const PROTECTED_PATHS = [
  "/dashboard",
  "/subscriptions",
  "/receipts",
  "/contact",
  "/admin",
];

/**
 * Keeps the cached `user` in localStorage in sync with the server session
 * cookie. When the session is missing or expired, the cached user is cleared
 * so the UI stops showing a signed-in state that the API no longer accepts.
 */
export default function SessionSync() {
  const router = useRouter();

  useEffect(() => {
    let rawUser: string | null = null;

    try {
      rawUser = window.localStorage.getItem("user");
    } catch {
      return;
    }

    if (!rawUser) {
      return;
    }

    let cancelled = false;

    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          window.localStorage.removeItem("user");
          window.localStorage.removeItem("remember");

          const path = window.location.pathname;

          if (
            PROTECTED_PATHS.some(
              (item) => path === item || path.startsWith(`${item}/`),
            )
          ) {
            router.replace(
              `/login?redirect=${encodeURIComponent(
                path + window.location.search,
              )}`,
            );
          }

          return;
        }

        if (response.ok) {
          const data = await response.json();

          if (data?.user) {
            window.localStorage.setItem("user", JSON.stringify(data.user));
          }
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
