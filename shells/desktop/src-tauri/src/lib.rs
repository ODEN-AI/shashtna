//! شاشتنا Console — Windows shell around the web Console
//! (https://shashtna.netlify.app/admin). No second UI and no IPC: the window
//! shows the same Console pages; the native side adds the device session
//! (Credential Manager + Phase 10A exchange), deep links, controlled
//! navigation, the offline page and normal desktop window behaviour.

mod cookies;
mod http;
mod store;
#[cfg(windows)]
mod webview2;

use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant};

use shashtna_console_core::links::DeepLinkResolver;
use shashtna_console_core::policy::{Decision, NavigationPolicy};
use shashtna_console_core::routes::ConsoleRoutes;
use shashtna_console_core::session::{
    device_label, throttled_message, Coordinator, CredentialStore, Outcome, SessionCookies, SessionResult,
};
use tauri::webview::{DownloadEvent, NewWindowResponse, PageLoadEvent};
use tauri::window::Color;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;
use url::Url;

use crate::cookies::WebviewCookies;
use crate::http::NativeHttp;
use crate::store::WindowsCredentialStore;

const MAIN: &str = "main";
const TITLE: &str = "شاشتنا Console";
const FOCUS_CHECK_INTERVAL: Duration = Duration::from_secs(60);
const RETRY_GUARD: Duration = Duration::from_secs(30);

/// The shell's bundled pages (`frontendDist`), served by Tauri over HTTPS on Windows.
fn local_url(page: &str) -> String {
    if cfg!(windows) {
        format!("https://tauri.localhost/{page}")
    } else {
        format!("tauri://localhost/{page}")
    }
}

/// Newtype so the core trait can be implemented for the shared cookie bridge.
struct SharedCookies(Arc<WebviewCookies>);

impl SessionCookies for SharedCookies {
    fn current(&self) -> Option<String> {
        self.0.current()
    }
    fn apply(&self, set_cookies: &[String]) -> bool {
        self.0.apply(set_cookies)
    }
}

type Session = Coordinator<NativeHttp, WindowsCredentialStore, SharedCookies>;

#[derive(Default)]
struct Ui {
    session_started: bool,
    last_failed: Option<String>,
    last_focus_check: Option<Instant>,
    last_register: Option<Instant>,
    last_login_restore: Option<Instant>,
    came_from_login: bool,
    device_limit_shown: bool,
}

struct Shell {
    app: AppHandle<Wry>,
    routes: ConsoleRoutes,
    policy: NavigationPolicy,
    session: Session,
    window: OnceLock<WebviewWindow<Wry>>,
    ui: Mutex<Ui>,
}

fn elapsed(since: Option<Instant>, at_least: Duration) -> bool {
    since.is_none_or(|t| t.elapsed() >= at_least)
}

impl Shell {
    fn ui(&self) -> MutexGuard<'_, Ui> {
        self.ui.lock().unwrap_or_else(|p| p.into_inner())
    }

    fn navigate(&self, target: &str) {
        if let (Some(window), Ok(url)) = (self.window.get(), Url::parse(target)) {
            let _ = window.navigate(url);
        }
    }

    fn current_url(&self) -> Option<String> {
        self.window.get()?.url().ok().map(|u| u.to_string())
    }

    fn notify(&self, text: impl Into<String>) {
        let mut dialog = self.app.dialog().message(text).title(TITLE).kind(MessageDialogKind::Info);
        if let Some(window) = self.window.get() {
            dialog = dialog.parent(window);
        }
        dialog.show(|_| {});
    }

    fn notify_result(&self, result: SessionResult) {
        match result.outcome {
            Outcome::Throttled => self.notify(throttled_message(result.retry_after)),
            Outcome::Rejected => self.notify("انتهت جلسة هذا الجهاز. سجّل الدخول مجددًا."),
            _ => {}
        }
    }

    fn show_offline(&self, failed: String) {
        self.ui().last_failed = Some(failed);
        self.navigate(&local_url("offline.html"));
    }

    // ---------------------------------------------------------------- session

    /// Restore the device session (if any), then open `target` in the Console.
    fn start_session(self: &Arc<Self>, target: String) {
        self.ui().session_started = false;
        let shell = self.clone();
        std::thread::spawn(move || {
            let result = shell.session.restore();
            if result.outcome == Outcome::Offline {
                shell.show_offline(target);
                return;
            }
            shell.notify_result(result);
            // Signed in (device session) or not: the Console decides what to show
            // (its own sign-in page without a session, "no permission" for 403).
            shell.ui().session_started = true;
            shell.navigate(&target);
        });
    }

    /// After a Console page loads, turn a password sign-in into a device session.
    fn maybe_register(self: &Arc<Self>, url: &str) {
        {
            let mut ui = self.ui();
            let after_login = ui.came_from_login;
            ui.came_from_login = self.policy.is_login(url);
            if !self.policy.is_console_admin(url) {
                return;
            }
            if !after_login && (self.session.store().has_credential() || !elapsed(ui.last_register, RETRY_GUARD)) {
                return;
            }
            ui.last_register = Some(Instant::now());
        }
        let shell = self.clone();
        std::thread::spawn(move || {
            let result = shell.session.maybe_register();
            match result.outcome {
                Outcome::DeviceLimit => {
                    let first = !std::mem::replace(&mut shell.ui().device_limit_shown, true);
                    if first {
                        shell.notify("وصلت للحد الأعلى من الأجهزة. ألغِ جهازًا قديمًا من صفحة «الأمان والجلسات» ليبقى هذا الجهاز مسجّلًا.");
                    }
                }
                Outcome::Throttled => shell.notify_result(result),
                _ => {}
            }
        });
    }

    /// The device cookie (≤ 12 h) can end while the app is open and the Console
    /// then shows /login. With a credential still stored, renew silently and go
    /// back (only to a Console page), at most once per 30 s so a refusal can't loop.
    fn restore_at_login(self: &Arc<Self>, login_url: &str) {
        {
            let mut ui = self.ui();
            if !self.session.store().has_credential() || !elapsed(ui.last_login_restore, RETRY_GUARD) {
                return;
            }
            ui.last_login_restore = Some(Instant::now());
        }
        let back = Url::parse(login_url)
            .ok()
            .and_then(|u| u.query_pairs().find(|(k, _)| k == "redirect").map(|(_, v)| v.into_owned()))
            .filter(|r| r.starts_with('/'))
            .map(|r| self.routes.url(&r))
            .filter(|u| self.policy.is_console_admin(u));
        let target = back.unwrap_or_else(|| self.routes.url("/admin"));

        let shell = self.clone();
        std::thread::spawn(move || {
            let result = shell.session.restore();
            if result.outcome == Outcome::Ok {
                shell.navigate(&target);
            } else {
                shell.notify_result(result);
            }
        });
    }

    /// Window focused: re-check the session at most once a minute.
    fn on_focus(self: &Arc<Self>) {
        {
            let mut ui = self.ui();
            if !ui.session_started || !elapsed(ui.last_focus_check, FOCUS_CHECK_INTERVAL) {
                return;
            }
            ui.last_focus_check = Some(Instant::now());
        }
        let shell = self.clone();
        std::thread::spawn(move || {
            let Some(url) = shell.current_url().filter(|u| shell.policy.is_console_admin(u)) else {
                return;
            };
            let result = shell.session.check();
            match result.outcome {
                Outcome::Restored => shell.navigate(&url),
                Outcome::SignedOut | Outcome::Rejected => {
                    // 401: the Console's sign-in page, returning here afterwards.
                    let path = Url::parse(&url).map(|u| match u.query() {
                        Some(q) => format!("{}?{q}", u.path()),
                        None => u.path().to_string(),
                    });
                    let mut login = Url::parse(&shell.routes.url("/login")).expect("valid origin");
                    login
                        .query_pairs_mut()
                        .append_pair("redirect", &path.unwrap_or_else(|_| "/admin".into()));
                    shell.navigate(login.as_str());
                    if result.outcome == Outcome::Rejected {
                        shell.notify_result(result);
                    }
                }
                Outcome::Throttled => shell.notify_result(result),
                // Offline: the Console page shows its own connection state; nothing is faked.
                _ => {}
            }
        });
    }

    // ---------------------------------------------------------------- navigation

    /// Every top-level navigation. `false` cancels it.
    fn on_navigation(self: &Arc<Self>, url: &Url) -> bool {
        let raw = url.as_str();
        match self.policy.decide(raw) {
            Decision::Console => true,
            Decision::Local => {
                // Back/forward must not strand the user on the loading page.
                let loading = matches!(url.path(), "/" | "/index.html");
                if loading && self.ui().session_started {
                    let shell = self.clone();
                    std::thread::spawn(move || shell.navigate(&shell.routes.url("/admin")));
                    return false;
                }
                true
            }
            Decision::DeepLink => {
                self.on_deep_link(raw.to_string());
                false
            }
            Decision::External => {
                self.open_external(raw);
                false
            }
            Decision::Block => false,
        }
    }

    /// `window.open` / `target="_blank"`: never a second window.
    fn on_new_window(self: &Arc<Self>, url: &Url) {
        match self.policy.decide(url.as_str()) {
            Decision::Console => self.navigate(url.as_str()),
            Decision::External => self.open_external(url.as_str()),
            Decision::DeepLink => self.on_deep_link(url.to_string()),
            _ => {}
        }
    }

    /// Legitimate outside destinations open in the default Windows handler (browser, mail, phone).
    fn open_external(&self, url: &str) {
        let _ = self.app.opener().open_url(url, None::<&str>);
    }

    fn on_page_loaded(self: &Arc<Self>, url: &str) {
        if self.policy.decide(url) != Decision::Console {
            return;
        }
        if self.policy.is_login(url) {
            self.restore_at_login(url);
        }
        self.maybe_register(url);
    }

    // ---------------------------------------------------------------- deep links

    /// `shashtna-console://…` from Windows (cold or warm start) or from a page.
    fn on_deep_link(self: &Arc<Self>, link: String) {
        if let Some(window) = self.window.get() {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        let shell = self.clone();
        std::thread::spawn(move || {
            // The offline page's retry link: reopen what failed.
            let on_offline_page = shell.current_url().is_some_and(|u| u == local_url("offline.html"));
            let last_failed = shell.ui().last_failed.clone();
            if let (true, Some(failed)) = (on_offline_page, last_failed) {
                shell.start_session(failed);
                return;
            }
            // Unknown or malformed links open the Console home (contract: console-links.ts).
            let target = DeepLinkResolver::new(&shell.routes).target_or_home(&link);
            if shell.ui().session_started {
                shell.navigate(&target);
            } else {
                shell.start_session(target);
            }
        });
    }

    fn on_main_frame_offline(self: &Arc<Self>, url: String) {
        if self.policy.decide(&url) == Decision::Console {
            self.show_offline(url);
        }
    }
}

fn setup(app: &mut tauri::App<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    let routes = ConsoleRoutes::bundled();
    let version = app.package_info().version.to_string();
    let cookies = Arc::new(WebviewCookies::new(&routes.origin));
    let session = Coordinator::new(
        NativeHttp::new(&routes.origin, &version),
        WindowsCredentialStore,
        SharedCookies(cookies.clone()),
        version,
        device_label(std::env::var("COMPUTERNAME").ok().as_deref()),
    );
    let shell = Arc::new(Shell {
        app: app.handle().clone(),
        policy: NavigationPolicy::new(&routes),
        routes,
        session,
        window: OnceLock::new(),
        ui: Mutex::new(Ui::default()),
    });
    app.manage(shell.clone());

    let (nav, new_window, page) = (shell.clone(), shell.clone(), shell.clone());
    let downloads = NavigationPolicy::new(&shell.routes);
    let window = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App("index.html".into()))
        .title(TITLE)
        .inner_size(1280.0, 800.0)
        .min_inner_size(960.0, 600.0)
        .center()
        .resizable(true)
        .maximizable(true)
        .minimizable(true)
        .closable(true)
        .background_color(Color(2, 11, 43, 255))
        .use_https_scheme(true)
        // File drops go to the Console page (uploads), not to the native side.
        .disable_drag_drop_handler()
        // No WebView2 form autofill: admin data typed into the Console is not stored locally.
        .general_autofill_enabled(false)
        .on_navigation(move |url| nav.on_navigation(url))
        .on_new_window(move |url, _features| {
            new_window.on_new_window(&url);
            NewWindowResponse::Deny
        })
        .on_download(move |_webview, event| match event {
            // Exports the Console offers (its own origin only) save like in a browser.
            DownloadEvent::Requested { url, .. } => downloads.decide(url.as_str()) == Decision::Console,
            _ => true,
        })
        .on_page_load(move |_window, payload| {
            if payload.event() == PageLoadEvent::Finished {
                page.on_page_loaded(payload.url().as_str());
            }
        })
        .build()?;
    cookies.attach(window.clone());
    let _ = shell.window.set(window.clone());

    #[cfg(windows)]
    {
        let (logout, offline) = (shell.clone(), shell.clone());
        webview2::install(
            &window,
            shell.routes.url("/api/auth/logout"),
            move || logout.session.on_web_logout(),
            move |url| offline.on_main_frame_offline(url),
        );
        // Per-user registration (HKCU) of shashtna-console:// for dev and portable runs; the installer registers it too.
        let _ = app.deep_link().register_all();
    }

    let linked = shell.clone();
    app.deep_link().on_open_url(move |event| {
        if let Some(url) = event.urls().first() {
            linked.on_deep_link(url.to_string());
        }
    });

    let initial = app.deep_link().get_current().ok().flatten().and_then(|urls| {
        urls.into_iter()
            .map(|u| u.to_string())
            .find(|u| shell.policy.decide(u) == Decision::DeepLink)
    });
    let resolver = DeepLinkResolver::new(&shell.routes);
    let target = initial
        .map(|link| resolver.target_or_home(&link))
        .unwrap_or_else(|| shell.routes.url("/admin"));
    shell.start_session(target);
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        // Must be first: a second launch (e.g. a deep link) is handed to the running window.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(MAIN) {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(setup)
        .on_window_event(|window, event| {
            if let WindowEvent::Focused(true) = event {
                if let Some(shell) = window.try_state::<Arc<Shell>>() {
                    shell.on_focus();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to start شاشتنا Console");
}
