# شاشتنا Console — Android shell (Phase 10C-A)

A Capacitor 8 wrapper around the web Console (`https://shashtna.netlify.app/admin`).
No second UI and no JavaScript bridge: the WebView shows the same Console pages;
the native layer adds the device session, deep links, back handling, the splash
and system bars. Contract: `src/lib/console-api.ts`, `src/lib/console-client.ts`,
`src/lib/console-links.ts`; server side: `docs/console-native-foundation.md`.

| | |
|---|---|
| Package | `com.shashtna.console` (pending approval before any Play upload) |
| Name | شاشتنا Console |
| Version | 0.1.0 (versionCode 1) |
| SDK | min 24 · target/compile 36 · Java 21 · AGP 8.13 · Gradle 8.14.3 |
| Deep links | `shashtna-console://admin/...` (no App Links yet) |

## Build (debug)

Needs JDK 21 and the Android SDK (platform 36, build-tools) with `ANDROID_HOME` set.

```sh
cd shells/mobile
npm ci
npm run build:debug        # routes → cap sync → ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
cd android && ./gradlew testDebugUnitTest lintDebug
```

`npm run routes` regenerates `android/app/src/main/assets/console-routes.txt` from
`src/lib/console-links.ts`; the root test suite fails if it is stale.

## Layout

| File | Role |
|---|---|
| `MainActivity.java` | Splash, WebView hardening, boot/session flow, resume check, deep links, back |
| `ConsoleWebViewClient.java` | Every navigation through `NavigationPolicy`; sign-out interception |
| `NavigationPolicy.java` | CONSOLE / LOCAL / DEEP_LINK / EXTERNAL / BLOCK (pure, unit-tested) |
| `DeepLinkResolver.java`, `ConsoleRoutes.java` | Same rules as `console-links.ts`, table from the generated asset |
| `SessionCoordinator.java` | exchange · register · check · logout (Phase 10A/10B endpoints) |
| `ConsoleApi.java` | Native HTTP to `/api/console/v1`, WebView cookie jar, no logging |
| `CredentialStore.java` | Android Keystore AES-256-GCM; ciphertext only in app-private prefs |
| `www/` | Bundled loading and offline pages (no scripts, CSP `default-src 'none'`) |

## Manual validation (emulator or device)

Use a staff account on a non-production deployment where possible. Never paste a
credential, cookie or password into a log, ticket or chat.

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.shashtna.console/.MainActivity
```

1. **Launch** — navy splash with the شاشتنا logo, then the Console sign-in page. Launcher label «شاشتنا Console».
2. **Login** — sign in with a staff password. Console Home opens. On *الأمان والجلسات* (`/admin/security`) a new Android device appears (label = phone model).
3. **Resume (cold)** — `adb shell am force-stop com.shashtna.console`, relaunch: Console Home opens without the password.
4. **Resume (warm)** — Home button, wait > 60 s, return: still signed in. Revoke the device from a desktop browser, wait > 60 s, return: the app goes to the sign-in page with «انتهت جلسة هذا الجهاز…».
5. **Logout** — sign out from the Console menu; force-stop; relaunch: the sign-in page (no silent sign-in). The device shows as signed out on the security page.
6. **Back** — open Orders → an order → Back returns to Orders → Back to Home → Back sends the app to the background (does not close the session, never shows the loading page).
7. **Deep links**
   ```sh
   adb shell am start -a android.intent.action.VIEW -d "shashtna-console://admin/orders/SH-000042"
   adb shell am start -a android.intent.action.VIEW -d "shashtna-console://admin/operations?queue=payments"
   adb shell am start -a android.intent.action.VIEW -d "shashtna-console://admin/nope"          # → Console Home
   adb shell am start -a android.intent.action.VIEW -d "shashtna-console://admin/../etc/passwd" # → Console Home
   ```
   A role without the section's permission sees the Console's own "no permission" page.
8. **External URLs** — a WhatsApp / phone / outside link in the Console (e.g. a customer's contact on Customer 360) opens WhatsApp / the dialer / the browser, never inside the app.
9. **Offline** — airplane mode, relaunch: «لا يوجد اتصال بالإنترنت» page; turn the network on, tap «إعادة المحاولة»: the Console opens.
10. **Throttle** — enter wrong passwords until the login is throttled: the Console shows its message; a 429 on exchange shows «محاولات كثيرة. حاول بعد … دقيقة».
11. **RTL / system bars** — Arabic layout right-to-left; status and navigation bars navy with light icons; the Console header and bottom nav are not hidden under the bars (portrait and landscape, gesture and 3-button navigation).
12. **Secure storage**
    ```sh
    adb shell run-as com.shashtna.console cat shared_prefs/shashtna_console_secure.xml
    ```
    Only `credential_gcm` (base64 ciphertext) and `device_id` — never `scd1.`. `adb backup` / cloud backup exclude app data (`allowBackup=false`).
13. **No secrets in logs** — during steps 2–9:
    ```sh
    adb logcat -d | grep -iE "scd1\.|shashtna_session|credential|password" && echo LEAK || echo clean
    ```
