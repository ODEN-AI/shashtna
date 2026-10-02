//! `shashtna-console://admin/...` → canonical Console web URL, with the same
//! rules as `deepLinkToWebUrl` in `src/lib/console-links.ts`: existing routes
//! only, `:id` a positive integer (orders also accept `SH-000042`), `:uuid` a
//! ticket id, only page-relevant query keys (≤ 100 chars), no traversal, no
//! user info or port. Anything else → `None` (the shell opens `/admin`).
//!
//! Parsing uses the WHATWG URL parser (`url` crate), the same algorithm as
//! `new URL()` in the web contract, and query output uses
//! `application/x-www-form-urlencoded` like `URLSearchParams`.

use url::Url;

use crate::routes::ConsoleRoutes;

fn is_id(value: &str) -> bool {
    let bytes = value.as_bytes();
    (1..=10).contains(&bytes.len()) && (b'1'..=b'9').contains(&bytes[0]) && bytes.iter().all(u8::is_ascii_digit)
}

fn is_uuid(value: &str) -> bool {
    (8..=64).contains(&value.len()) && value.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

/// Mirrors `parseOrderNumber` (`src/lib/order-status.ts`): `^(?:SH-)?0*(\d{1,9})$` after trim + upper-case.
pub fn parse_order_number(value: &str) -> Option<u32> {
    let upper = value.trim().to_ascii_uppercase();
    let digits = upper.strip_prefix("SH-").unwrap_or(&upper);
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let trimmed = digits.trim_start_matches('0');
    let significant = if trimmed.is_empty() { "0" } else { trimmed };
    if significant.len() > 9 {
        return None;
    }
    significant.parse().ok()
}

pub struct DeepLinkResolver<'a> {
    routes: &'a ConsoleRoutes,
}

impl<'a> DeepLinkResolver<'a> {
    pub fn new(routes: &'a ConsoleRoutes) -> Self {
        Self { routes }
    }

    /// The canonical `/admin` path for a candidate path (`canonicalConsolePath`), or `None`.
    pub fn canonical_path(&self, path: &str) -> Option<String> {
        let trimmed = path.trim_end_matches('/');
        let clean = if trimmed.is_empty() { "/" } else { trimmed };
        if clean.contains("..") || clean.contains("//") {
            return None;
        }
        let parts: Vec<&str> = clean.split('/').collect();

        'routes: for pattern in &self.routes.patterns {
            let want: Vec<&str> = pattern.split('/').collect();
            if want.len() != parts.len() {
                continue;
            }
            let mut out = Vec::with_capacity(parts.len());
            for (w, got) in want.iter().zip(&parts) {
                match *w {
                    ":id" => {
                        let id = if pattern.starts_with("/admin/orders/") {
                            parse_order_number(got).map(|n| n.to_string())
                        } else if is_id(got) {
                            Some((*got).to_string())
                        } else {
                            None
                        };
                        match id {
                            Some(id) if is_id(&id) => out.push(id),
                            _ => continue 'routes,
                        }
                    }
                    ":uuid" if is_uuid(got) => out.push((*got).to_string()),
                    ":uuid" => continue 'routes,
                    literal if literal == *got => out.push((*got).to_string()),
                    _ => continue 'routes,
                }
            }
            return Some(out.join("/"));
        }
        None
    }

    fn kept_query(&self, url: &Url) -> String {
        let pairs: Vec<(String, String)> = url.query_pairs().map(|(k, v)| (k.into_owned(), v.into_owned())).collect();
        let mut out = url::form_urlencoded::Serializer::new(String::new());
        let mut any = false;
        for key in &self.routes.query_keys {
            // URLSearchParams.get(): the first value for the key.
            if let Some((_, value)) = pairs.iter().find(|(k, _)| k == key) {
                if value.chars().count() <= 100 {
                    out.append_pair(key, value);
                    any = true;
                }
            }
        }
        if any {
            format!("?{}", out.finish())
        } else {
            String::new()
        }
    }

    /// `shashtna-console://admin/orders/42?queue=payments` → `/admin/orders/42?queue=payments`.
    pub fn to_console_path(&self, link: &str) -> Option<String> {
        let url = Url::parse(link).ok()?;
        if url.scheme() != self.routes.scheme || !url.username().is_empty() || url.password().is_some() || url.port().is_some() {
            return None;
        }
        let host = url.host_str()?;
        let path = if url.path() == "/" { "" } else { url.path() };
        let canonical = self.canonical_path(&format!("/{host}{path}"))?;
        Some(format!("{canonical}{}", self.kept_query(&url)))
    }

    /// The canonical web URL a deep link opens, or `None`.
    pub fn to_web_url(&self, link: &str) -> Option<String> {
        self.to_console_path(link).map(|path| self.routes.url(&path))
    }

    /// What the shell opens for a link: its web URL, or the Console home for anything unknown or malformed.
    pub fn target_or_home(&self, link: &str) -> String {
        self.to_web_url(link).unwrap_or_else(|| self.routes.url("/admin"))
    }
}
