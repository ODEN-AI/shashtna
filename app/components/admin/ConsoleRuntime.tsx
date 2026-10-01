"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LogIn, WifiOff } from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { SESSION_EXPIRED_EVENT } from "@/app/ui/session-events";
import { useToast } from "@/app/ui/Toast";

/**
 * Runtime of the installable Shashtna Console (the /admin PWA):
 *  - registers the app-shell service worker (production only, /admin scope)
 *  - shows a connection banner while offline and refreshes on reconnect
 *  - asks the admin to sign in again when the session is gone (401)
 * It renders nothing else and holds no business data.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// beforeinstallprompt can fire before React mounts: capture it at module load.
let installEvent: InstallEvent | null = null;
const installListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installEvent = event as InstallEvent;
    installListeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    installListeners.forEach((listener) => listener());
  });
}

/** Whether the browser offers installation right now (Chromium: Edge/Chrome on Windows and Android). */
export function useInstallPrompt() {
  const available = useSyncExternalStore(
    (listener) => {
      installListeners.add(listener);
      return () => installListeners.delete(listener);
    },
    () => Boolean(installEvent),
    () => false,
  );

  return {
    available,
    install: async () => {
      const event = installEvent;
      if (!event) return;
      await event.prompt();
      await event.userChoice.catch(() => undefined);
      installEvent = null;
      installListeners.forEach((listener) => listener());
    },
  };
}

/** True when running as the installed app (its own window, no browser UI). */
export function useStandalone() {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia("(display-mode: standalone)");
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => false,
  );
}

function useOnline() {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener("online", listener);
      window.addEventListener("offline", listener);
      return () => {
        window.removeEventListener("online", listener);
        window.removeEventListener("offline", listener);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** Sign out of the console: end the session, drop the shell cache, return to login. */
export async function consoleSignOut() {
  try {
    window.localStorage.removeItem("user");
    window.localStorage.removeItem("remember");
  } catch {
    // Storage can be unavailable; the cookie is what matters.
  }

  navigator.serviceWorker?.controller?.postMessage("CLEAR_CACHE");
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  // A full load (not router.push) so no authenticated page stays in the
  // client router cache after sign-out.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/login?redirect=/admin";
}

export function ConsoleRuntime() {
  const { t } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const online = useOnline();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !window.isSecureContext) {
      return;
    }

    navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin", updateViaCache: "none" }).catch((error) => {
      console.error("CONSOLE_SW_REGISTER_ERROR:", error);
    });
  }, []);

  // Reconnected: tell the admin and reload the current data.
  useEffect(() => {
    const onOnline = () => {
      toast(t("تمت استعادة الاتصال.", "You're back online."));
      router.refresh();
    };
    window.addEventListener("online", onOnline);

    return () => window.removeEventListener("online", onOnline);
  }, [toast, router, t]);

  useEffect(() => {
    const onExpired = () => setSessionExpired(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const here = typeof window === "undefined" ? "/admin" : `${window.location.pathname}${window.location.search}`;

  return (
    <>
      {!online ? (
        <div role="status" aria-live="polite" data-testid="console-offline" className="sticky top-16 z-20 flex items-center justify-center gap-2 border-b border-warning/25 bg-[#2a2208]/95 px-4 py-2 text-center text-sm font-semibold text-warning backdrop-blur">
          <WifiOff size={15} aria-hidden />
          {t("أنت غير متصل بالإنترنت. ستُحدَّث البيانات تلقائيًا عند عودة الاتصال.", "You're offline. Data will refresh automatically when the connection returns.")}
        </div>
      ) : null}

      {sessionExpired ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" role="alertdialog" aria-modal="true" aria-labelledby="session-expired-title" data-testid="console-session-expired">
          <div className="glass-strong w-full max-w-sm rounded-[1.75rem] p-6 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand/20 text-brand-ink">
              <LogIn size={22} aria-hidden />
            </span>
            <h2 id="session-expired-title" className="mt-4 text-lg font-bold text-ink">
              {t("انتهت جلسة تسجيل الدخول", "Your session has ended")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-2">
              {t("سجّل الدخول مرة ثانية حتى تكمل. ما راح تنحفظ أي تغييرات ما أرسلتها.", "Sign in again to continue. Changes you haven't sent aren't saved.")}
            </p>
            <a href={`/login?redirect=${encodeURIComponent(here)}`} className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand-strong">
              {t("تسجيل الدخول", "Sign in")}
            </a>
          </div>
        </div>
      ) : null}
    </>
  );
}
