//! Platform-independent logic of the شاشتنا Console desktop shell.
//!
//! Nothing here touches Tauri, WebView2, the network or the credential
//! store directly: those are traits implemented by the app crate, so the
//! rules can be unit-tested on any host. The contracts mirrored here live in
//! `src/lib/console-api.ts`, `src/lib/console-client.ts` and
//! `src/lib/console-links.ts` (Phases 10A/10B); the route table itself is
//! generated from `console-links.ts` (`console-routes.txt`).

pub mod links;
pub mod policy;
pub mod routes;
pub mod session;
