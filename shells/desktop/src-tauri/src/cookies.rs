//! Bridges the WebView2 cookie store for the Console origin.
//!
//! Must only be used from worker threads: reading WebView2 cookies from the
//! UI thread inside an event handler deadlocks (Tauri docs, wry#583).

use std::sync::OnceLock;

use shashtna_console_core::session::{SessionCookies, SESSION_COOKIE};
use tauri::webview::Cookie;
use tauri::{WebviewWindow, Wry};
use url::Url;

pub struct WebviewCookies {
    window: OnceLock<WebviewWindow<Wry>>,
    origin: Url,
}

impl WebviewCookies {
    pub fn new(origin: &str) -> Self {
        Self {
            window: OnceLock::new(),
            origin: Url::parse(origin).expect("valid Console origin"),
        }
    }

    pub fn attach(&self, window: WebviewWindow<Wry>) {
        let _ = self.window.set(window);
    }
}

impl SessionCookies for WebviewCookies {
    fn current(&self) -> Option<String> {
        let window = self.window.get()?;
        let cookies = window.cookies_for_url(self.origin.clone()).ok()?;
        cookies
            .iter()
            .find(|c| c.name() == SESSION_COOKIE && !c.value().is_empty())
            .map(|c| format!("{}={}", c.name(), c.value()))
    }

    fn apply(&self, set_cookies: &[String]) -> bool {
        let Some(window) = self.window.get() else { return false };
        let host = self.origin.host_str().unwrap_or_default().to_string();
        let mut applied = false;
        for header in set_cookies {
            let Ok(mut cookie) = Cookie::parse(header.clone()) else { continue };
            // Host-only cookie for the Console origin, exactly as the browser would store it.
            if cookie.domain().is_none() {
                cookie.set_domain(host.clone());
            }
            if cookie.path().is_none() {
                cookie.set_path("/");
            }
            if cookie.secure().is_none() {
                cookie.set_secure(true);
            }
            applied |= window.set_cookie(cookie).is_ok();
        }
        applied
    }
}
