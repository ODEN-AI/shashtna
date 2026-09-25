"use client";

import { useEffect } from "react";

/**
 * Keeps the cached `user` in localStorage (read by a few older admin
 * screens) in sync with the server session. Page protection itself is done
 * on the server; this only clears a stale cached user.
 */
export default function SessionSync({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    try {
      if (!signedIn) {
        window.localStorage.removeItem("user");
        window.localStorage.removeItem("remember");
        return;
      }
    } catch {
      return;
    }

    let cancelled = false;

    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (cancelled || !response.ok) {
          return;
        }

        const data = await response.json();

        if (data?.user) {
          window.localStorage.setItem("user", JSON.stringify(data.user));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  return null;
}
