package com.shashtna.console;

import android.os.Build;

import org.json.JSONObject;

/**
 * The device-session lifecycle (Phase 10A/10B contract). All methods do
 * network I/O: call them off the main thread.
 *
 *   launch   → restore(): stored credential → POST /session/exchange
 *              (server sets the normal HttpOnly session cookie, ≤ 12 h).
 *   sign-in  → maybeRegister(): after a password sign-in in the WebView,
 *              GET /session; a browser session is turned into a device:
 *              POST /devices/register → Keystore → exchange at once, so the
 *              WebView now holds a device session (and a later logout ends
 *              the credential on the server too).
 *   resume   → check(): GET /session; on 401 try restore() once.
 *   sign-out → onWebLogout(): POST /session/logout with the current cookie,
 *              then forget the credential locally.
 *
 * The credential is read from the Keystore only for the exchange request
 * body and is never logged, never put in a URL, header, cookie or the
 * WebView. 403 is never "fixed" here: permissions come from the server.
 *
 * Methods are synchronized so a sign-out never overtakes a registration in
 * flight (the logout then ends the freshly registered device too).
 */
final class SessionCoordinator {
    enum Outcome {
        /** Session is valid (restored, registered or already fine). */
        OK,
        /** check(): the session had ended and was renewed from the credential — reload the page. */
        RESTORED,
        /** Nothing stored / not signed in: the Console shows its sign-in page. */
        SIGNED_OUT,
        /** The stored credential was refused (revoked, expired, 7-day maximum): cleared. */
        REJECTED,
        /** 429: wait {@link Result#retryAfter} seconds. */
        THROTTLED,
        /** No connection / timeout. */
        OFFLINE,
        /** 409 DEVICE_LIMIT at registration (the browser session still works). */
        DEVICE_LIMIT,
        /** 5xx or an unexpected response. */
        ERROR
    }

    static final class Result {
        final Outcome outcome;
        final int retryAfter;

        Result(Outcome outcome, int retryAfter) {
            this.outcome = outcome;
            this.retryAfter = retryAfter;
        }

        static Result of(Outcome outcome) {
            return new Result(outcome, 0);
        }
    }

    private final ConsoleApi api;
    private final CredentialStore store;
    private final String appVersion;

    SessionCoordinator(ConsoleApi api, CredentialStore store, String appVersion) {
        this.api = api;
        this.store = store;
        this.appVersion = appVersion;
    }

    /** Trade the stored credential for a session cookie. */
    synchronized Result restore() {
        String credential = store.load();
        if (credential == null) return Result.of(Outcome.SIGNED_OUT);

        JSONObject body = new JSONObject();
        try {
            body.put("credential", credential);
        } catch (Exception e) {
            return Result.of(Outcome.ERROR);
        }
        credential = null;
        ConsoleApi.Result result = api.post("/session/exchange", body);

        if (result.ok()) {
            api.applyCookies(result.setCookies);
            return Result.of(Outcome.OK);
        }
        return failure(result, true);
    }

    /**
     * After the Console page loaded: if the WebView holds a password (browser)
     * session, register this device and switch to a device session.
     */
    synchronized Result maybeRegister() {
        ConsoleApi.Result session = api.get("/session");
        if (!session.ok()) return failure(session, false);

        JSONObject info = session.body.optJSONObject("session");
        if (info == null) return Result.of(Outcome.ERROR);
        if ("device".equals(info.optString("kind"))) return Result.of(Outcome.OK);

        Result registered = register(store.deviceId());
        if (registered.outcome == Outcome.REJECTED) {
            // The remembered device row was revoked: register a new device.
            store.clearAll();
            registered = register(null);
        }
        return registered;
    }

    private Result register(Integer deviceId) {
        JSONObject body = new JSONObject();
        try {
            body.put("platform", "ANDROID");
            body.put("label", deviceLabel());
            body.put("appVersion", appVersion);
            if (deviceId != null && deviceId > 0) body.put("deviceId", deviceId);
        } catch (Exception e) {
            return Result.of(Outcome.ERROR);
        }

        ConsoleApi.Result result = api.post("/devices/register", body);
        if (!result.ok()) {
            if (result.status == 409 && "DEVICE_REVOKED".equals(result.code())) return Result.of(Outcome.REJECTED);
            if (result.status == 409 && "DEVICE_LIMIT".equals(result.code())) return Result.of(Outcome.DEVICE_LIMIT);
            return failure(result, false);
        }

        String credential = result.body.optString("credential", "");
        JSONObject device = result.body.optJSONObject("device");
        if (credential.isEmpty() || device == null || !store.save(credential, device.optInt("id"))) return Result.of(Outcome.ERROR);

        // Exchange at once: the WebView switches to the device-bound session.
        Result exchanged = restore();
        return exchanged.outcome == Outcome.REJECTED ? Result.of(Outcome.ERROR) : exchanged;
    }

    /** GET /session (resume). On 401 try the stored credential once. */
    synchronized Result check() {
        ConsoleApi.Result session = api.get("/session");
        if (session.ok()) return Result.of(Outcome.OK);
        if (session.status == 401) {
            if (!store.hasCredential()) return Result.of(Outcome.SIGNED_OUT);
            Result restored = restore();
            return restored.outcome == Outcome.OK ? Result.of(Outcome.RESTORED) : restored;
        }
        return failure(session, false);
    }

    /** The Console's own sign-out was pressed: end the device session and forget the credential. */
    synchronized void onWebLogout() {
        api.post("/session/logout", new JSONObject());
        store.clearCredential();
    }

    private Result failure(ConsoleApi.Result result, boolean exchanging) {
        if (result.status == ConsoleApi.NETWORK_ERROR) return Result.of(Outcome.OFFLINE);
        if (result.status == 429) return new Result(Outcome.THROTTLED, result.retryAfter > 0 ? result.retryAfter : 60);
        if (result.status == 401) {
            if (exchanging) {
                store.clearCredential();
                return Result.of(Outcome.REJECTED);
            }
            return Result.of(Outcome.SIGNED_OUT);
        }
        // 403 (e.g. a customer account): not staff — leave it to the Console page.
        if (result.status == 403) return Result.of(Outcome.SIGNED_OUT);
        return Result.of(Outcome.ERROR);
    }

    private static String deviceLabel() {
        String model = (Build.MANUFACTURER + " " + Build.MODEL).replaceAll("[\\p{Cntrl}]", "").trim();
        if (model.length() > 60) model = model.substring(0, 60);
        return model.isEmpty() ? "Android" : model;
    }
}
