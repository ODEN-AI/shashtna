//! Native HTTP to `/api/console/v1` (blocking; called from worker threads only).
//!
//! HTTPS only, 15 s timeout, no redirects, no cookie store (the session cookie
//! is passed explicitly per request from the WebView), no `Origin` header
//! (native requests are not cross-site; the server rejects foreign origins).
//! Bodies, cookies and credentials are never logged.

use std::io::Read;
use std::sync::OnceLock;
use std::time::Duration;

use reqwest::blocking::{Client, RequestBuilder};
use reqwest::header::{ACCEPT, CACHE_CONTROL, CONTENT_TYPE, COOKIE, RETRY_AFTER, SET_COOKIE};
use serde_json::Value;
use shashtna_console_core::session::{ConsoleHttp, HttpResponse};

const MAX_BODY: u64 = 256 * 1024;

pub struct NativeHttp {
    // Built on first use, on a worker thread (a blocking client must not be
    // created inside an async runtime context).
    client: OnceLock<Option<Client>>,
    base: String,
    user_agent: String,
}

impl NativeHttp {
    pub fn new(origin: &str, app_version: &str) -> Self {
        Self {
            client: OnceLock::new(),
            base: format!("{origin}/api/console/v1"),
            user_agent: format!("ShashtnaConsole/{app_version} (Windows)"),
        }
    }

    fn client(&self) -> Option<&Client> {
        self.client
            .get_or_init(|| {
                Client::builder()
                    .https_only(true)
                    .timeout(Duration::from_secs(15))
                    .connect_timeout(Duration::from_secs(15))
                    .redirect(reqwest::redirect::Policy::none())
                    .user_agent(self.user_agent.clone())
                    .build()
                    .ok()
            })
            .as_ref()
    }

    fn send(&self, request: Option<RequestBuilder>, cookie: Option<&str>) -> HttpResponse {
        let Some(mut request) = request else {
            return HttpResponse::network_error();
        };
        request = request.header(ACCEPT, "application/json").header(CACHE_CONTROL, "no-store");
        if let Some(cookie) = cookie {
            request = request.header(COOKIE, cookie);
        }
        let Ok(response) = request.send() else {
            return HttpResponse::network_error();
        };

        let status = response.status().as_u16();
        let header_retry = response
            .headers()
            .get(RETRY_AFTER)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.trim().parse::<u64>().ok())
            .unwrap_or(0);
        let set_cookies = response
            .headers()
            .get_all(SET_COOKIE)
            .iter()
            .filter_map(|v| v.to_str().ok().map(str::to_owned))
            .collect();

        let mut text = String::new();
        let body = match response.take(MAX_BODY).read_to_string(&mut text) {
            Ok(_) if text.trim_start().starts_with('{') => serde_json::from_str(&text).unwrap_or(Value::Null),
            _ => Value::Null,
        };
        let retry_after = body
            .get("retryAfter")
            .and_then(Value::as_u64)
            .filter(|s| *s > 0)
            .unwrap_or(header_retry);

        HttpResponse {
            status,
            body,
            retry_after,
            set_cookies,
        }
    }
}

impl ConsoleHttp for NativeHttp {
    fn get(&self, path: &str, cookie: Option<&str>) -> HttpResponse {
        let request = self.client().map(|c| c.get(format!("{}{path}", self.base)));
        self.send(request, cookie)
    }

    fn post(&self, path: &str, body: &Value, cookie: Option<&str>) -> HttpResponse {
        let request = self.client().map(|c| {
            c.post(format!("{}{path}", self.base))
                .header(CONTENT_TYPE, "application/json")
                .body(body.to_string())
        });
        self.send(request, cookie)
    }
}
