"use client";

import { useEffect } from "react";

/**
 * Older builds of the site cached the signed-in user in localStorage. The
 * session now lives only in the HttpOnly cookie, so a stale cached copy is
 * cleared when the visitor isn't signed in.
 */
export default function SessionSync({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    if (signedIn) {
      return;
    }

    try {
      window.localStorage.removeItem("user");
      window.localStorage.removeItem("remember");
    } catch {
      // Storage may be unavailable (private mode); nothing to clean up.
    }
  }, [signedIn]);

  return null;
}
