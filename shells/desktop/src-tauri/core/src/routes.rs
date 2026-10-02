//! The Console deep-link table, generated from `src/lib/console-links.ts` by
//! `scripts/console-routes.ts` into `console-routes.txt` (same file format as
//! the Android shell). Routes are never written by hand on the native side.

use std::collections::BTreeSet;

/// The generated table compiled into the binary.
pub const BUNDLED: &str = include_str!("../console-routes.txt");

#[derive(Debug, Clone)]
pub struct ConsoleRoutes {
    pub origin: String,
    pub scheme: String,
    pub patterns: Vec<String>,
    /// In contract order (`CONSOLE_QUERY_KEYS`), which is also the output order.
    pub query_keys: Vec<String>,
}

impl ConsoleRoutes {
    pub fn parse(text: &str) -> Result<Self, &'static str> {
        let (mut origin, mut scheme) = (None, None);
        let mut patterns = Vec::new();
        let mut query_keys = Vec::new();
        let mut seen = BTreeSet::new();

        for raw in text.lines() {
            let line = raw.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let Some((kind, value)) = line.split_once(' ') else { continue };
            let value = value.trim().to_string();
            match kind {
                "origin" => origin = Some(value),
                "scheme" => scheme = Some(value),
                "route" => patterns.push(value),
                "query" => {
                    if seen.insert(value.clone()) {
                        query_keys.push(value);
                    }
                }
                _ => {}
            }
        }

        match (origin, scheme) {
            (Some(origin), Some(scheme)) if !patterns.is_empty() => Ok(Self {
                origin,
                scheme,
                patterns,
                query_keys,
            }),
            _ => Err("console-routes: missing origin, scheme or routes"),
        }
    }

    pub fn bundled() -> Self {
        Self::parse(BUNDLED).expect("console-routes.txt is generated and checked by the root test suite")
    }

    /// `https://shashtna.netlify.app` + path.
    pub fn url(&self, path: &str) -> String {
        format!("{}{}", self.origin, path)
    }
}
