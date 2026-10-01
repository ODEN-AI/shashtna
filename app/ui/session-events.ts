/**
 * Browser-side signal that the signed-in session is gone (HTTP 401 from an
 * API, or a server action answering UNAUTHENTICATED). The admin console
 * listens for it and asks the user to sign in again.
 */
export const SESSION_EXPIRED_EVENT = "shashtna:session-expired";

export function announceSessionExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}
