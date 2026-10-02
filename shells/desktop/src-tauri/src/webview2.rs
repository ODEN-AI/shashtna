//! WebView2 hooks Tauri does not expose for remote pages (Windows only).
//!
//! * The Console's own sign-out (`POST /api/auth/logout`) is held with a
//!   WebView2 deferral while the shell ends the device session natively
//!   (`POST /api/console/v1/session/logout`) and forgets the credential; the
//!   Console's request then continues unchanged and clears the cookie.
//! * A failed top-level navigation to the Console (no connection, DNS,
//!   timeout) is reported so the shell can show its offline page.

use std::sync::Arc;

use tauri::webview::PlatformWebview;
use tauri::{AppHandle, Manager, WebviewWindow, Wry};
use webview2_com::Microsoft::Web::WebView2::Win32::*;
use webview2_com::{take_pwstr, NavigationCompletedEventHandler, WebResourceRequestedEventHandler};
use windows::core::{BOOL, HSTRING, PWSTR};

/// A WebView2 deferral moved to a worker thread and back. It is only ever
/// used (`Complete`) on the UI thread, via `run_on_main_thread`.
struct UiThreadDeferral(ICoreWebView2Deferral);
// SAFETY: the COM object is not touched off the UI thread; it is only carried.
unsafe impl Send for UiThreadDeferral {}

const OFFLINE_STATUSES: [COREWEBVIEW2_WEB_ERROR_STATUS; 7] = [
    COREWEBVIEW2_WEB_ERROR_STATUS_CANNOT_CONNECT,
    COREWEBVIEW2_WEB_ERROR_STATUS_CONNECTION_ABORTED,
    COREWEBVIEW2_WEB_ERROR_STATUS_CONNECTION_RESET,
    COREWEBVIEW2_WEB_ERROR_STATUS_DISCONNECTED,
    COREWEBVIEW2_WEB_ERROR_STATUS_HOST_NAME_NOT_RESOLVED,
    COREWEBVIEW2_WEB_ERROR_STATUS_SERVER_UNREACHABLE,
    COREWEBVIEW2_WEB_ERROR_STATUS_TIMEOUT,
];

pub fn install(
    window: &WebviewWindow<Wry>,
    logout_url: String,
    on_logout: impl Fn() + Send + Sync + 'static,
    on_offline: impl Fn(String) + Send + Sync + 'static,
) {
    let app = window.app_handle().clone();
    let on_logout: Arc<dyn Fn() + Send + Sync> = Arc::new(on_logout);
    let on_offline: Arc<dyn Fn(String) + Send + Sync> = Arc::new(on_offline);
    let _ = window.with_webview(move |webview| {
        // SAFETY: called on the UI thread with a live WebView2 controller.
        let _ = unsafe { hook(&webview, app, logout_url, on_logout, on_offline) };
    });
}

unsafe fn hook(
    webview: &PlatformWebview,
    app: AppHandle<Wry>,
    logout_url: String,
    on_logout: Arc<dyn Fn() + Send + Sync>,
    on_offline: Arc<dyn Fn(String) + Send + Sync>,
) -> windows::core::Result<()> {
    let core = webview.controller().CoreWebView2()?;
    let mut token = 0i64;

    core.AddWebResourceRequestedFilter(&HSTRING::from(logout_url.as_str()), COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL)?;
    core.add_WebResourceRequested(
        &WebResourceRequestedEventHandler::create(Box::new(move |_sender, args| {
            let Some(args) = args else { return Ok(()) };
            let request = args.Request()?;
            let mut method = PWSTR::null();
            request.Method(&mut method)?;
            let method = take_pwstr(method);
            let mut uri = PWSTR::null();
            request.Uri(&mut uri)?;
            let uri = take_pwstr(uri);
            let is_logout = uri == logout_url || uri.strip_prefix(logout_url.as_str()).is_some_and(|rest| rest.starts_with('?'));
            if !(method.eq_ignore_ascii_case("POST") && is_logout) {
                return Ok(());
            }

            let deferral = UiThreadDeferral(args.GetDeferral()?);
            let (app, on_logout) = (app.clone(), on_logout.clone());
            std::thread::spawn(move || {
                on_logout();
                let _ = app.run_on_main_thread(move || {
                    let deferral = deferral;
                    // Let the Console's own request through unchanged.
                    let _ = unsafe { deferral.0.Complete() };
                });
            });
            Ok(())
        })),
        &mut token,
    )?;

    core.add_NavigationCompleted(
        &NavigationCompletedEventHandler::create(Box::new(move |sender, args| {
            let (Some(sender), Some(args)) = (sender, args) else {
                return Ok(());
            };
            let mut success = BOOL::default();
            args.IsSuccess(&mut success)?;
            if success.as_bool() {
                return Ok(());
            }
            let mut status = COREWEBVIEW2_WEB_ERROR_STATUS::default();
            args.WebErrorStatus(&mut status)?;
            if OFFLINE_STATUSES.contains(&status) {
                let mut source = PWSTR::null();
                sender.Source(&mut source)?;
                on_offline(take_pwstr(source));
            }
            Ok(())
        })),
        &mut token,
    )?;

    Ok(())
}
