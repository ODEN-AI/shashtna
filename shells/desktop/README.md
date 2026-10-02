# شاشتنا Console — Windows shell (Phase 10C-B)

A Tauri 2 window around the web Console (`https://shashtna.netlify.app/admin`).
No second UI and no IPC: the window shows the same Console pages; the native
side adds the device session, deep links, controlled navigation, the offline
page and normal desktop window behaviour. Contract: `src/lib/console-api.ts`,
`src/lib/console-client.ts`, `src/lib/console-links.ts`; server side:
`docs/console-native-foundation.md`.

| | |
|---|---|
| Identifier | `com.shashtna.console` (same as Android; pending approval before distribution) |
| Name | شاشتنا Console (`shashtna-console.exe`) |
| Version | 0.1.0 |
| Stack | Tauri 2.12.1 · Rust ≥ 1.90 · WebView2 · NSIS per-user installer |
| Deep links | `shashtna-console://admin/...` |

## Prerequisites (Windows 10/11 x64)

- Rust (MSVC toolchain): `rustup default stable-x86_64-pc-windows-msvc` (≥ 1.90)
- Visual Studio 2022 Build Tools with **Desktop development with C++** (MSVC + Windows SDK)
- WebView2 Runtime (built into Windows 11; the installer bootstraps it on Windows 10)
- Node 22 + npm (only for the Tauri CLI)

## Run / build

```powershell
cd shells\desktop
npm ci
npm test                    # core crate: routes, deep links, policy, session lifecycle
npm run dev                 # debug build + launch (devtools available in debug only)
npm run build               # release exe + NSIS installer
# exe:       src-tauri\target\release\shashtna-console.exe
# installer: src-tauri\target\release\bundle\nsis\شاشتنا Console_0.1.0_x64-setup.exe
```

`npm run routes` regenerates `src-tauri/core/console-routes.txt` from
`src/lib/console-links.ts`; the root test suite fails if it is stale.

## Layout

| Path | Role |
|---|---|
| `src-tauri/core/` | Pure Rust, no Tauri: route table, deep-link resolver, navigation policy, session lifecycle (unit-tested with fakes) |
| `src-tauri/src/lib.rs` | Window, navigation/new-window/download handlers, boot/focus/login-page session flow, deep links |
| `src-tauri/src/webview2.rs` | WebView2 hooks: the Console's sign-out request (deferred while the device session ends) and offline detection |
| `src-tauri/src/http.rs` | Native HTTPS client for `/api/console/v1` (no redirects, no cookie store, no logging) |
| `src-tauri/src/store.rs` | Windows Credential Manager (`com.shashtna.console` / `device-credential`, `device-id`) |
| `src-tauri/src/cookies.rs` | WebView2 cookie store bridge for the Console origin |
| `www/` | Bundled loading and offline pages (no scripts) |

## Manual validation (Windows)

Use a test staff account. Never paste a credential, cookie or password into a log, ticket or chat.

1. **Launch** — `npm run dev` (or the installed app): navy window titled «شاشتنا Console», 1280×800, centred; the Console sign-in page appears.
2. **Login** — sign in with a staff password; Console Home opens. On *الأمان والجلسات* (`/admin/security`) a new **Windows** device appears (label `Windows · <PC name>`).
3. **Close / reopen** — close the window (✕), relaunch: Console Home opens without the password.
4. **Focus resume** — leave the app unfocused > 60 s, focus it: still signed in. Revoke the device from another browser, wait > 60 s, focus: the Console sign-in page and «انتهت جلسة هذا الجهاز…».
5. **Logout** — sign out from the Console menu; close; relaunch: the sign-in page (no silent sign-in). The device shows as signed out on the security page. Credential Manager (step 12) no longer has `device-credential`.
6. **Window** — minimise, maximise/restore (button and double-click title bar), resize to the minimum (960×600), close; Alt+Left / Alt+Right never strand you on the loading page.
7. **Deep link, cold start** — with the app closed:
   ```powershell
   Start-Process "shashtna-console://admin/orders/SH-000042"
   ```
   The app opens on that order (after sign-in if needed).
8. **Deep link, warm start** — with the app open (also minimised):
   ```powershell
   Start-Process "shashtna-console://admin/operations?queue=payments"
   Start-Process "shashtna-console://admin/nope"            # → Console Home
   Start-Process "shashtna-console://admin/../etc/passwd"   # → Console Home
   ```
   The existing window comes to the front and navigates; no second instance starts.
9. **External links** — a WhatsApp (`wa.me`), mail or phone link in the Console (e.g. Customer 360) opens in the default browser / mail / phone app; the Console window stays where it was.
10. **Origin restriction** — in a debug build's devtools console (F12):
    ```js
    location.href = "https://example.com"      // opens in the browser, window stays
    location.href = "http://shashtna.netlify.app/admin"   // ignored
    location.href = "file:///C:/Windows/win.ini"          // ignored
    window.open("https://example.com")         // browser, no second window
    window.__TAURI_INTERNALS__?.invoke("plugin:opener|open_url", { url: "https://example.com" })  // rejected (no permission)
    ```
11. **RTL / Arabic** — Arabic text renders right-to-left with correct shaping in the Console and in the loading/offline pages; title bar shows «شاشتنا Console».
12. **Secure storage** — Control Panel → Credential Manager → Windows Credentials → Generic: `device-credential` and `device-id` under `com.shashtna.console` (value not shown). No credential in `%LOCALAPPDATA%\com.shashtna.console`:
    ```powershell
    Select-String -Path "$env:LOCALAPPDATA\com.shashtna.console\*" -Pattern "scd1\." -Recurse -ErrorAction SilentlyContinue
    ```
    (must print nothing)
13. **Offline** — disconnect the network, relaunch: «لا يوجد اتصال بالإنترنت»; reconnect, «إعادة المحاولة»: the Console opens. Disconnect while using the Console: the Console's own connection state is shown, nothing is reported as done.
14. **Throttle** — repeated wrong passwords: the Console's own message; a 429 on exchange shows «محاولات كثيرة. حاول بعد … دقيقة».
15. **No secrets in output** — run `npm run dev` from a terminal through steps 2–9; the terminal must not contain `scd1.`, `shashtna_session=` or a password.
