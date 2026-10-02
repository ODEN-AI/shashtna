//! The device-session lifecycle (Phase 10A/10B contract, same flow as the
//! Android shell's `SessionCoordinator`). Every method does network I/O:
//! call it off the UI thread.
//!
//! * launch   → [`Coordinator::restore`]: stored credential →
//!   `POST /session/exchange`; the server's `Set-Cookie` (the normal HttpOnly
//!   session cookie, ≤ 12 h) is put into the WebView cookie store.
//! * sign-in  → [`Coordinator::maybe_register`]: after a password sign-in in
//!   the WebView, `GET /session`; a `browser` session becomes a device:
//!   `POST /devices/register` → secure storage → exchange at once.
//! * focus    → [`Coordinator::check`]: `GET /session`; on 401 exchange once.
//! * sign-out → [`Coordinator::on_web_logout`]: `POST /session/logout` with the
//!   current session (the server ends it and clears the device credential),
//!   then the credential is forgotten locally.
//!
//! The credential is read from secure storage only for the exchange request
//! body. It is never logged, never sent as a header, cookie or URL, and never
//! handed to the WebView or page JavaScript. 403 is never "fixed" here: the
//! Console's server decides permissions.

use std::sync::Mutex;

use serde_json::{json, Value};

/// `SESSION_COOKIE` in `src/lib/mobile-auth.ts` (checked by the root test suite).
pub const SESSION_COOKIE: &str = "shashtna_session";
/// `CONSOLE_PLATFORMS` value for this shell.
pub const PLATFORM: &str = "WINDOWS";
/// Status used for "no response" (connection refused, DNS, TLS, timeout).
pub const NETWORK_ERROR: u16 = 0;

#[derive(Debug, Clone, Default)]
pub struct HttpResponse {
    pub status: u16,
    pub body: Value,
    /// Seconds (body `retryAfter`, else the `Retry-After` header), 0 if absent.
    pub retry_after: u64,
    pub set_cookies: Vec<String>,
}

impl HttpResponse {
    pub fn ok(&self) -> bool {
        (200..300).contains(&self.status)
    }

    pub fn code(&self) -> &str {
        self.body.get("code").and_then(Value::as_str).unwrap_or("")
    }

    pub fn network_error() -> Self {
        Self {
            status: NETWORK_ERROR,
            body: Value::Null,
            retry_after: 0,
            set_cookies: Vec::new(),
        }
    }
}

/// Native HTTP to `<origin>/api/console/v1<path>`. Never sends an `Origin` header,
/// never follows redirects, never caches, never logs bodies or cookies.
pub trait ConsoleHttp: Send + Sync {
    fn get(&self, path: &str, cookie: Option<&str>) -> HttpResponse;
    fn post(&self, path: &str, body: &Value, cookie: Option<&str>) -> HttpResponse;
}

/// OS-protected storage for the device credential (Windows Credential Manager).
pub trait CredentialStore: Send + Sync {
    fn load(&self) -> Option<String>;
    fn save(&self, credential: &str, device_id: i64) -> bool;
    fn has_credential(&self) -> bool;
    /// Device id for re-binding after a new sign-in (not secret).
    fn device_id(&self) -> Option<i64>;
    /// Signed out / refused: forget the credential, keep the device id.
    fn clear_credential(&self);
    /// Device revoked on the server: forget everything.
    fn clear_all(&self);
}

/// The WebView's cookie store for the Console origin.
pub trait SessionCookies: Send + Sync {
    /// `Cookie` request-header value for the Console origin (the session cookie), if any.
    fn current(&self) -> Option<String>;
    /// Put the server's `Set-Cookie` headers into the WebView (HttpOnly/Secure preserved).
    fn apply(&self, set_cookies: &[String]) -> bool;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    /// Session valid (restored, registered or already fine).
    Ok,
    /// `check()`: the session had ended and was renewed from the credential — reload.
    Restored,
    /// Nothing stored / not signed in / not staff: the Console shows its own page.
    SignedOut,
    /// The stored credential was refused (revoked, expired, 7-day maximum): cleared.
    Rejected,
    /// 429: wait `retry_after` seconds.
    Throttled,
    /// No connection / timeout.
    Offline,
    /// 409 `DEVICE_LIMIT` at registration (the password session still works).
    DeviceLimit,
    /// 5xx, unusable response, or secure storage failed.
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SessionResult {
    pub outcome: Outcome,
    pub retry_after: u64,
}

impl SessionResult {
    fn of(outcome: Outcome) -> Self {
        Self { outcome, retry_after: 0 }
    }
}

/// `name=value` of the session cookie in a list of `Set-Cookie` headers.
pub fn session_cookie_from(set_cookies: &[String]) -> Option<String> {
    set_cookies.iter().find_map(|header| {
        let pair = header.split(';').next()?.trim();
        let (name, value) = pair.split_once('=')?;
        (name.trim() == SESSION_COOKIE && !value.trim().is_empty()).then(|| pair.to_string())
    })
}

/// Device label sent at registration: printable, ≤ 60 chars (`cleanDeviceLabel`).
pub fn device_label(computer_name: Option<&str>) -> String {
    let name: String = computer_name.unwrap_or("").chars().filter(|c| !c.is_control()).collect();
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    let label = if name.is_empty() {
        "Windows".to_string()
    } else {
        format!("Windows · {name}")
    };
    label.chars().take(60).collect()
}

pub struct Coordinator<H, S, C> {
    http: H,
    store: S,
    cookies: C,
    app_version: String,
    label: String,
    // Serialises the lifecycle so a sign-out never overtakes a registration in
    // flight (the logout then ends the freshly registered device too).
    lock: Mutex<()>,
}

impl<H: ConsoleHttp, S: CredentialStore, C: SessionCookies> Coordinator<H, S, C> {
    pub fn new(http: H, store: S, cookies: C, app_version: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            http,
            store,
            cookies,
            app_version: app_version.into(),
            label: label.into(),
            lock: Mutex::new(()),
        }
    }

    pub fn store(&self) -> &S {
        &self.store
    }

    fn guard(&self) -> std::sync::MutexGuard<'_, ()> {
        self.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// Trade the stored credential for a session cookie in the WebView.
    pub fn restore(&self) -> SessionResult {
        let _guard = self.guard();
        self.restore_inner()
    }

    fn exchange(&self) -> Option<HttpResponse> {
        let credential = self.store.load()?;
        let body = json!({ "credential": credential });
        Some(self.http.post("/session/exchange", &body, None))
    }

    fn restore_inner(&self) -> SessionResult {
        let Some(response) = self.exchange() else {
            return SessionResult::of(Outcome::SignedOut);
        };
        if response.ok() {
            return if self.cookies.apply(&response.set_cookies) {
                SessionResult::of(Outcome::Ok)
            } else {
                SessionResult::of(Outcome::Error)
            };
        }
        self.failure(&response, true)
    }

    /// After a Console page loaded: a password (browser) session becomes a device session.
    pub fn maybe_register(&self) -> SessionResult {
        let _guard = self.guard();
        let cookie = self.cookies.current();
        let session = self.http.get("/session", cookie.as_deref());
        if !session.ok() {
            return self.failure(&session, false);
        }
        match session.body.pointer("/session/kind").and_then(Value::as_str) {
            Some("device") => return SessionResult::of(Outcome::Ok),
            Some("browser") => {}
            _ => return SessionResult::of(Outcome::Error),
        }

        let mut registered = self.register(self.store.device_id(), cookie.as_deref());
        if registered.outcome == Outcome::Rejected {
            // The remembered device row was revoked: register as a new device.
            self.store.clear_all();
            registered = self.register(None, cookie.as_deref());
        }
        registered
    }

    fn register(&self, device_id: Option<i64>, cookie: Option<&str>) -> SessionResult {
        let mut body = json!({ "platform": PLATFORM, "label": self.label, "appVersion": self.app_version });
        if let Some(id) = device_id.filter(|id| *id > 0) {
            body["deviceId"] = json!(id);
        }

        let response = self.http.post("/devices/register", &body, cookie);
        if !response.ok() {
            return match (response.status, response.code()) {
                (409, "DEVICE_REVOKED") => SessionResult::of(Outcome::Rejected),
                (409, "DEVICE_LIMIT") => SessionResult::of(Outcome::DeviceLimit),
                _ => self.failure(&response, false),
            };
        }

        let credential = response.body.get("credential").and_then(Value::as_str).unwrap_or("");
        let id = response.body.pointer("/device/id").and_then(Value::as_i64);
        let Some(id) = id.filter(|_| !credential.is_empty()) else {
            return SessionResult::of(Outcome::Error);
        };
        if !self.store.save(credential, id) {
            return SessionResult::of(Outcome::Error);
        }

        // Exchange at once: the WebView switches to the device-bound session.
        match self.restore_inner() {
            r if r.outcome == Outcome::Rejected => SessionResult::of(Outcome::Error),
            r => r,
        }
    }

    /// `GET /session` (window focus / resume). On 401 try the stored credential once.
    pub fn check(&self) -> SessionResult {
        let _guard = self.guard();
        let session = self.http.get("/session", self.cookies.current().as_deref());
        if session.ok() {
            return SessionResult::of(Outcome::Ok);
        }
        if session.status == 401 {
            if !self.store.has_credential() {
                return SessionResult::of(Outcome::SignedOut);
            }
            let restored = self.restore_inner();
            return if restored.outcome == Outcome::Ok {
                SessionResult::of(Outcome::Restored)
            } else {
                restored
            };
        }
        self.failure(&session, false)
    }

    /// The Console's own sign-out was pressed: end the device session on the server, then forget the credential.
    pub fn on_web_logout(&self) {
        let _guard = self.guard();
        let cookie = self.cookies.current().or_else(|| {
            // No cookie left in the WebView: end the device through a fresh, native-only
            // device session so the server still clears the credential.
            self.exchange()
                .filter(HttpResponse::ok)
                .and_then(|r| session_cookie_from(&r.set_cookies))
        });
        if let Some(cookie) = cookie {
            self.http.post("/session/logout", &json!({}), Some(&cookie));
        }
        self.store.clear_credential();
    }

    fn failure(&self, response: &HttpResponse, exchanging: bool) -> SessionResult {
        match response.status {
            NETWORK_ERROR => SessionResult::of(Outcome::Offline),
            429 => SessionResult {
                outcome: Outcome::Throttled,
                retry_after: if response.retry_after > 0 { response.retry_after } else { 60 },
            },
            401 if exchanging => {
                self.store.clear_credential();
                SessionResult::of(Outcome::Rejected)
            }
            401 => SessionResult::of(Outcome::SignedOut),
            // 403 (customer account, foreign origin): not a staff session — the Console page decides.
            403 => SessionResult::of(Outcome::SignedOut),
            _ => SessionResult::of(Outcome::Error),
        }
    }
}

/// Whole minutes to show for a 429 (rounded up, at least 1).
pub fn retry_minutes(retry_after_seconds: u64) -> u64 {
    retry_after_seconds.div_ceil(60).max(1)
}

/// Arabic "try again in N minutes" for a 429 (Arabic plural forms).
pub fn throttled_message(retry_after_seconds: u64) -> String {
    match retry_minutes(retry_after_seconds) {
        1 => "محاولات كثيرة. حاول بعد دقيقة.".to_string(),
        2 => "محاولات كثيرة. حاول بعد دقيقتين.".to_string(),
        n @ 3..=10 => format!("محاولات كثيرة. حاول بعد {n} دقائق."),
        n => format!("محاولات كثيرة. حاول بعد {n} دقيقة."),
    }
}
