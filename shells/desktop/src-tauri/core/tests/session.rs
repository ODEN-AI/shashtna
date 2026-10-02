//! Device-session lifecycle against fakes of the Console API, the credential
//! store and the WebView cookie jar (no network, no OS store).

use std::collections::VecDeque;
use std::sync::Mutex;

use serde_json::{json, Value};
use shashtna_console_core::session::*;

const CREDENTIAL: &str = "scd1.7.ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ";
const DEVICE_COOKIE: &str = "shashtna_session=device.token; Path=/; Expires=Wed, 01 Oct 2036 00:00:00 GMT; HttpOnly; Secure; SameSite=lax";

#[derive(Debug, Clone)]
struct Call {
    method: &'static str,
    path: String,
    body: Option<Value>,
    cookie: Option<String>,
}

#[derive(Default)]
struct FakeHttp {
    replies: Mutex<VecDeque<HttpResponse>>,
    calls: Mutex<Vec<Call>>,
}

impl FakeHttp {
    fn reply(self, status: u16, body: Value) -> Self {
        let set_cookies = if status == 200 && body.get("expiresAt").is_some() {
            vec![DEVICE_COOKIE.to_string()]
        } else {
            vec![]
        };
        let retry_after = body.get("retryAfter").and_then(Value::as_u64).unwrap_or(0);
        self.replies.lock().unwrap().push_back(HttpResponse {
            status,
            body,
            retry_after,
            set_cookies,
        });
        self
    }
    fn next(&self) -> HttpResponse {
        self.replies.lock().unwrap().pop_front().expect("unexpected request")
    }
    fn calls(&self) -> Vec<Call> {
        self.calls.lock().unwrap().clone()
    }
}

impl ConsoleHttp for &FakeHttp {
    fn get(&self, path: &str, cookie: Option<&str>) -> HttpResponse {
        self.calls.lock().unwrap().push(Call {
            method: "GET",
            path: path.into(),
            body: None,
            cookie: cookie.map(Into::into),
        });
        self.next()
    }
    fn post(&self, path: &str, body: &Value, cookie: Option<&str>) -> HttpResponse {
        self.calls.lock().unwrap().push(Call {
            method: "POST",
            path: path.into(),
            body: Some(body.clone()),
            cookie: cookie.map(Into::into),
        });
        self.next()
    }
}

#[derive(Default)]
struct FakeStore {
    credential: Mutex<Option<String>>,
    device: Mutex<Option<i64>>,
}

impl FakeStore {
    fn with(credential: Option<&str>, device: Option<i64>) -> Self {
        Self {
            credential: Mutex::new(credential.map(Into::into)),
            device: Mutex::new(device),
        }
    }
    fn credential(&self) -> Option<String> {
        self.credential.lock().unwrap().clone()
    }
}

impl CredentialStore for &FakeStore {
    fn load(&self) -> Option<String> {
        self.credential()
    }
    fn save(&self, credential: &str, device_id: i64) -> bool {
        *self.credential.lock().unwrap() = Some(credential.into());
        *self.device.lock().unwrap() = Some(device_id);
        true
    }
    fn has_credential(&self) -> bool {
        self.credential().is_some()
    }
    fn device_id(&self) -> Option<i64> {
        *self.device.lock().unwrap()
    }
    fn clear_credential(&self) {
        *self.credential.lock().unwrap() = None;
    }
    fn clear_all(&self) {
        self.clear_credential();
        *self.device.lock().unwrap() = None;
    }
}

#[derive(Default)]
struct FakeCookies {
    jar: Mutex<Option<String>>,
    applied: Mutex<Vec<String>>,
}

impl FakeCookies {
    fn with(cookie: Option<&str>) -> Self {
        Self {
            jar: Mutex::new(cookie.map(Into::into)),
            applied: Mutex::default(),
        }
    }
}

impl SessionCookies for &FakeCookies {
    fn current(&self) -> Option<String> {
        self.jar.lock().unwrap().clone()
    }
    fn apply(&self, set_cookies: &[String]) -> bool {
        self.applied.lock().unwrap().extend(set_cookies.iter().cloned());
        if let Some(pair) = session_cookie_from(set_cookies) {
            *self.jar.lock().unwrap() = Some(pair);
        }
        true
    }
}

fn exchange_ok() -> Value {
    json!({ "ok": true, "expiresAt": 2_000_000_000, "user": { "id": 1 }, "device": { "id": 7, "platform": "WINDOWS", "label": "x" } })
}

fn session(kind: &str) -> Value {
    json!({ "ok": true, "user": { "id": 1 }, "session": { "kind": kind, "deviceId": null, "issuedAt": 1, "endsAt": 2 } })
}

fn coordinator<'a>(
    http: &'a FakeHttp,
    store: &'a FakeStore,
    cookies: &'a FakeCookies,
) -> Coordinator<&'a FakeHttp, &'a FakeStore, &'a FakeCookies> {
    Coordinator::new(http, store, cookies, "0.1.0", device_label(Some("OFFICE-PC")))
}

/// The credential may only ever travel in the body of /session/exchange.
fn assert_credential_contained(http: &FakeHttp) {
    for call in http.calls() {
        let in_body = call.body.as_ref().is_some_and(|b| b.to_string().contains(CREDENTIAL));
        assert!(!call.path.contains(CREDENTIAL), "credential in path");
        assert!(!call.cookie.as_deref().unwrap_or("").contains(CREDENTIAL), "credential in cookie");
        if in_body {
            assert_eq!(call.path, "/session/exchange", "credential sent to {}", call.path);
        }
    }
}

#[test]
fn restore_without_credential_makes_no_request() {
    let (http, store, cookies) = (FakeHttp::default(), FakeStore::default(), FakeCookies::default());
    assert_eq!(coordinator(&http, &store, &cookies).restore().outcome, Outcome::SignedOut);
    assert!(http.calls().is_empty());
}

#[test]
fn restore_exchanges_and_puts_the_cookie_in_the_webview() {
    let http = FakeHttp::default().reply(200, exchange_ok());
    let (store, cookies) = (FakeStore::with(Some(CREDENTIAL), Some(7)), FakeCookies::default());
    assert_eq!(coordinator(&http, &store, &cookies).restore().outcome, Outcome::Ok);
    let calls = http.calls();
    assert_eq!((calls[0].method, calls[0].path.as_str()), ("POST", "/session/exchange"));
    assert_eq!(calls[0].body, Some(json!({ "credential": CREDENTIAL })));
    assert_eq!(calls[0].cookie, None, "exchange carries the credential only");
    assert_eq!(*cookies.applied.lock().unwrap(), vec![DEVICE_COOKIE.to_string()]);
    assert_credential_contained(&http);
}

#[test]
fn refused_credential_is_forgotten_but_device_id_kept() {
    let http = FakeHttp::default().reply(401, json!({ "ok": false, "code": "UNAUTHENTICATED", "message": "x" }));
    let (store, cookies) = (FakeStore::with(Some(CREDENTIAL), Some(7)), FakeCookies::default());
    assert_eq!(coordinator(&http, &store, &cookies).restore().outcome, Outcome::Rejected);
    assert_eq!(store.credential(), None);
    assert_eq!(*store.device.lock().unwrap(), Some(7));
}

#[test]
fn throttled_and_offline_and_server_errors_keep_the_credential() {
    for (reply, want, retry) in [
        (
            HttpResponse {
                status: 429,
                body: json!({ "code": "RATE_LIMITED", "retryAfter": 300 }),
                retry_after: 300,
                set_cookies: vec![],
            },
            Outcome::Throttled,
            300,
        ),
        (
            HttpResponse {
                status: 429,
                body: json!({}),
                retry_after: 0,
                set_cookies: vec![],
            },
            Outcome::Throttled,
            60,
        ),
        (HttpResponse::network_error(), Outcome::Offline, 0),
        (
            HttpResponse {
                status: 500,
                body: json!({ "code": "SERVER_ERROR" }),
                retry_after: 0,
                set_cookies: vec![],
            },
            Outcome::Error,
            0,
        ),
    ] {
        let http = FakeHttp::default();
        http.replies.lock().unwrap().push_back(reply);
        let (store, cookies) = (FakeStore::with(Some(CREDENTIAL), Some(7)), FakeCookies::default());
        let result = coordinator(&http, &store, &cookies).restore();
        assert_eq!((result.outcome, result.retry_after), (want, retry));
        assert_eq!(store.credential().as_deref(), Some(CREDENTIAL));
    }
}

#[test]
fn password_sign_in_registers_this_pc_and_switches_to_a_device_session() {
    let http = FakeHttp::default()
        .reply(200, session("browser"))
        .reply(
            201,
            json!({ "ok": true, "device": { "id": 9 }, "credential": CREDENTIAL, "rebound": true }),
        )
        .reply(200, exchange_ok());
    let store = FakeStore::with(None, Some(9));
    let cookies = FakeCookies::with(Some("shashtna_session=browser.token"));
    assert_eq!(coordinator(&http, &store, &cookies).maybe_register().outcome, Outcome::Ok);

    let calls = http.calls();
    assert_eq!(
        calls.iter().map(|c| c.path.as_str()).collect::<Vec<_>>(),
        ["/session", "/devices/register", "/session/exchange"]
    );
    assert_eq!(calls[0].cookie.as_deref(), Some("shashtna_session=browser.token"));
    assert_eq!(calls[1].cookie.as_deref(), Some("shashtna_session=browser.token"));
    assert_eq!(
        calls[1].body,
        Some(json!({ "platform": "WINDOWS", "label": "Windows · OFFICE-PC", "appVersion": "0.1.0", "deviceId": 9 }))
    );
    assert_eq!(store.credential().as_deref(), Some(CREDENTIAL));
    assert_eq!(cookies.jar.lock().unwrap().as_deref(), Some("shashtna_session=device.token"));
    assert_credential_contained(&http);
}

#[test]
fn device_session_is_left_alone() {
    let http = FakeHttp::default().reply(200, session("device"));
    let (store, cookies) = (
        FakeStore::with(Some(CREDENTIAL), Some(7)),
        FakeCookies::with(Some("shashtna_session=d")),
    );
    assert_eq!(coordinator(&http, &store, &cookies).maybe_register().outcome, Outcome::Ok);
    assert_eq!(http.calls().len(), 1);
}

#[test]
fn revoked_device_registers_as_new() {
    let http = FakeHttp::default()
        .reply(200, session("browser"))
        .reply(409, json!({ "ok": false, "code": "DEVICE_REVOKED", "message": "x" }))
        .reply(
            201,
            json!({ "ok": true, "device": { "id": 10 }, "credential": CREDENTIAL, "rebound": false }),
        )
        .reply(200, exchange_ok());
    let (store, cookies) = (FakeStore::with(None, Some(7)), FakeCookies::with(Some("shashtna_session=b")));
    assert_eq!(coordinator(&http, &store, &cookies).maybe_register().outcome, Outcome::Ok);
    let calls = http.calls();
    assert_eq!(calls[1].body.as_ref().unwrap()["deviceId"], json!(7));
    assert!(calls[2].body.as_ref().unwrap().get("deviceId").is_none());
    assert_eq!(*store.device.lock().unwrap(), Some(10));
}

#[test]
fn device_limit_and_not_staff() {
    let http = FakeHttp::default()
        .reply(200, session("browser"))
        .reply(409, json!({ "ok": false, "code": "DEVICE_LIMIT", "message": "x" }));
    let (store, cookies) = (FakeStore::default(), FakeCookies::with(Some("shashtna_session=b")));
    assert_eq!(coordinator(&http, &store, &cookies).maybe_register().outcome, Outcome::DeviceLimit);
    assert_eq!(store.credential(), None);

    let http = FakeHttp::default().reply(403, json!({ "ok": false, "code": "FORBIDDEN", "message": "x" }));
    assert_eq!(
        coordinator(&http, &store, &cookies).maybe_register().outcome,
        Outcome::SignedOut,
        "403 is never bypassed"
    );
    assert_eq!(http.calls().len(), 1);
}

#[test]
fn check_renews_an_ended_session_once() {
    let http = FakeHttp::default().reply(200, session("device"));
    let (store, cookies) = (
        FakeStore::with(Some(CREDENTIAL), Some(7)),
        FakeCookies::with(Some("shashtna_session=d")),
    );
    assert_eq!(coordinator(&http, &store, &cookies).check().outcome, Outcome::Ok);

    let http = FakeHttp::default()
        .reply(401, json!({ "code": "UNAUTHENTICATED" }))
        .reply(200, exchange_ok());
    assert_eq!(coordinator(&http, &store, &cookies).check().outcome, Outcome::Restored);

    let http = FakeHttp::default().reply(401, json!({})).reply(401, json!({}));
    assert_eq!(coordinator(&http, &store, &cookies).check().outcome, Outcome::Rejected);
    assert_eq!(store.credential(), None);

    let http = FakeHttp::default().reply(401, json!({}));
    assert_eq!(
        coordinator(&http, &store, &cookies).check().outcome,
        Outcome::SignedOut,
        "no credential: straight to sign-in"
    );
    assert_eq!(http.calls().len(), 1);
}

#[test]
fn logout_ends_the_server_session_then_forgets_the_credential() {
    let http = FakeHttp::default().reply(200, json!({ "ok": true }));
    let (store, cookies) = (
        FakeStore::with(Some(CREDENTIAL), Some(7)),
        FakeCookies::with(Some("shashtna_session=device.token")),
    );
    coordinator(&http, &store, &cookies).on_web_logout();
    let calls = http.calls();
    assert_eq!(calls.len(), 1);
    assert_eq!(
        (calls[0].path.as_str(), calls[0].cookie.as_deref()),
        ("/session/logout", Some("shashtna_session=device.token"))
    );
    assert_eq!(store.credential(), None);
    assert_eq!(*store.device.lock().unwrap(), Some(7), "device id kept for re-binding");

    // Nothing to restore afterwards: reopening never signs in silently.
    assert_eq!(
        coordinator(&FakeHttp::default(), &store, &cookies).restore().outcome,
        Outcome::SignedOut
    );
}

#[test]
fn logout_without_a_webview_cookie_still_ends_the_device_on_the_server() {
    let http = FakeHttp::default().reply(200, exchange_ok()).reply(200, json!({ "ok": true }));
    let (store, cookies) = (FakeStore::with(Some(CREDENTIAL), Some(7)), FakeCookies::default());
    coordinator(&http, &store, &cookies).on_web_logout();
    let calls = http.calls();
    assert_eq!(
        calls.iter().map(|c| c.path.as_str()).collect::<Vec<_>>(),
        ["/session/exchange", "/session/logout"]
    );
    assert_eq!(calls[1].cookie.as_deref(), Some("shashtna_session=device.token"));
    assert!(
        cookies.applied.lock().unwrap().is_empty(),
        "the native-only session never reaches the WebView"
    );
    assert_eq!(store.credential(), None);
    assert_credential_contained(&http);
}

#[test]
fn logout_offline_still_forgets_locally() {
    let http = FakeHttp::default();
    http.replies.lock().unwrap().push_back(HttpResponse::network_error());
    let (store, cookies) = (
        FakeStore::with(Some(CREDENTIAL), Some(7)),
        FakeCookies::with(Some("shashtna_session=d")),
    );
    coordinator(&http, &store, &cookies).on_web_logout();
    assert_eq!(store.credential(), None);
}

#[test]
fn helpers() {
    assert_eq!(
        session_cookie_from(&[DEVICE_COOKIE.into()]).as_deref(),
        Some("shashtna_session=device.token")
    );
    assert_eq!(
        session_cookie_from(&["other=1; Path=/".into(), "shashtna_session=; Max-Age=0".into()]),
        None
    );
    assert_eq!(device_label(None), "Windows");
    assert_eq!(device_label(Some("  DESK\u{7}TOP  01 ")), "Windows · DESKTOP 01");
    assert_eq!(device_label(Some(&"x".repeat(100))).chars().count(), 60);
    assert_eq!(
        (retry_minutes(0), retry_minutes(59), retry_minutes(60), retry_minutes(61)),
        (1, 1, 1, 2)
    );
}

#[test]
fn throttled_messages_use_arabic_plurals() {
    assert_eq!(throttled_message(30), "محاولات كثيرة. حاول بعد دقيقة.");
    assert_eq!(throttled_message(120), "محاولات كثيرة. حاول بعد دقيقتين.");
    assert_eq!(throttled_message(300), "محاولات كثيرة. حاول بعد 5 دقائق.");
    assert_eq!(throttled_message(900), "محاولات كثيرة. حاول بعد 15 دقيقة.");
}
