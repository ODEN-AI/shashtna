//! What the shell does with a navigation request.
//!
//! * `Console` — HTTPS on the Console host, default port: load in the window.
//! * `Local` — the shell's bundled pages (`https://tauri.localhost` on
//!   Windows, `tauri://localhost` elsewhere).
//! * `DeepLink` — `shashtna-console://…`: resolved through [`crate::links`].
//! * `External` — another HTTPS site, `mailto:` or `tel:`: handed to the
//!   default Windows handler, never loaded in the window.
//! * `Block` — everything else (`http:`, `file:`, `javascript:`, `data:`,
//!   `blob:`, `about:`, unknown schemes, user info, other ports, malformed URLs).

use url::Url;

use crate::routes::ConsoleRoutes;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    Console,
    Local,
    DeepLink,
    External,
    Block,
}

pub struct NavigationPolicy {
    console_host: String,
    scheme: String,
}

impl NavigationPolicy {
    pub fn new(routes: &ConsoleRoutes) -> Self {
        let host = Url::parse(&routes.origin)
            .ok()
            .and_then(|u| u.host_str().map(str::to_ascii_lowercase))
            .unwrap_or_default();
        Self {
            console_host: host,
            scheme: routes.scheme.to_ascii_lowercase(),
        }
    }

    pub fn decide(&self, raw: &str) -> Decision {
        let Ok(url) = Url::parse(raw.trim()) else { return Decision::Block };
        let scheme = url.scheme();
        if scheme == self.scheme {
            return Decision::DeepLink;
        }
        let has_user = !url.username().is_empty() || url.password().is_some();
        let host = url.host_str().unwrap_or("").to_ascii_lowercase();
        match scheme {
            "https" => {
                if has_user || host.is_empty() {
                    Decision::Block
                } else if host == self.console_host {
                    // The WHATWG parser drops the default port, so any port here is non-default.
                    if url.port().is_none() {
                        Decision::Console
                    } else {
                        Decision::Block
                    }
                } else if host == "tauri.localhost" {
                    if url.port().is_none() {
                        Decision::Local
                    } else {
                        Decision::Block
                    }
                } else {
                    Decision::External
                }
            }
            "tauri" if host == "localhost" => Decision::Local,
            "mailto" | "tel" => Decision::External,
            _ => Decision::Block,
        }
    }

    fn console_path(&self, raw: &str) -> Option<String> {
        (self.decide(raw) == Decision::Console).then(|| Url::parse(raw.trim()).map(|u| u.path().to_string()).unwrap_or_default())
    }

    /// A Console URL under `/admin` (or `/admin` itself).
    pub fn is_console_admin(&self, raw: &str) -> bool {
        self.console_path(raw).is_some_and(|p| p == "/admin" || p.starts_with("/admin/"))
    }

    /// The Console sign-in page (where an ended session lands).
    pub fn is_login(&self, raw: &str) -> bool {
        self.console_path(raw).is_some_and(|p| p == "/login")
    }

    /// `/admin` home exactly (no sub-page).
    pub fn is_console_home(&self, raw: &str) -> bool {
        self.console_path(raw).is_some_and(|p| p == "/admin" || p == "/admin/")
    }
}
