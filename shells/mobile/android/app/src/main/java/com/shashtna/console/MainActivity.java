package com.shashtna.console;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * شاشتنا Console — a native shell around the web Console
 * (https://shashtna.netlify.app/admin). No second UI: the WebView shows the
 * same Console pages; the shell adds the device session, deep links, back
 * handling, the splash and system-bar handling.
 */
public class MainActivity extends BridgeActivity implements ConsoleWebViewClient.Listener {
    private static final String LOCAL_OFFLINE = "https://localhost/offline.html";
    private static final long SPLASH_MAX_MS = 8_000;
    private static final long RESUME_CHECK_INTERVAL_MS = 60_000;

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private ConsoleRoutes routes;
    private NavigationPolicy policy;
    private DeepLinkResolver resolver;
    private CredentialStore store;
    private SessionCoordinator session;

    private volatile boolean holdSplash = true;
    private boolean ready;
    private boolean sessionStarted;
    private boolean clearHistoryOnLoad;
    private boolean cameFromLogin;
    private String pendingTarget;
    private String lastFailedUrl;
    private long lastResumeCheck;
    private long lastRegisterAttempt;
    private long lastLoginRestore;
    private boolean deviceLimitShown;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(() -> holdSplash);
        main.postDelayed(() -> holdSplash = false, SPLASH_MAX_MS);

        super.onCreate(savedInstanceState);
        if (bridge == null || bridge.getWebView() == null) {
            holdSplash = false;
            return;
        }

        routes = ConsoleRoutes.parse(readAsset("console-routes.txt"));
        policy = new NavigationPolicy(routes);
        resolver = new DeepLinkResolver(routes);
        store = new CredentialStore(this);
        session = new SessionCoordinator(new ConsoleApi(routes.origin), store, BuildConfig.VERSION_NAME);

        WebView webView = bridge.getWebView();
        hardenWebView(webView);
        bridge.setWebViewClient(new ConsoleWebViewClient(bridge, policy, routes.origin, this));
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                goBack();
            }
        });

        ready = true;
        String linked = targetFor(getIntent());
        startSession(linked != null ? linked : consoleUrl("/admin"));
    }

    // ------------------------------------------------------------ WebView

    /**
     * The Console is a remote page: it gets no Capacitor bridge and no plugin
     * access (Capacitor exposes "androidBridge" to its own origin; older
     * WebViews would expose it to every origin, so it is removed outright).
     */
    private void hardenWebView(WebView webView) {
        webView.removeJavascriptInterface("androidBridge");
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.removeWebMessageListener(webView, "androidBridge");
        }

        WebSettings settings = webView.getSettings();
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);
        // Session pages must not be served from a stale cache after sign-out.
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    }

    private String consoleUrl(String path) {
        return routes.origin + path;
    }

    private void load(String url) {
        bridge.getWebView().loadUrl(url);
    }

    // ------------------------------------------------------------ session

    /** Restore the device session (if any) then open {@code target}. */
    private void startSession(String target) {
        sessionStarted = false;
        worker.execute(() -> {
            SessionCoordinator.Result result = session.restore();
            main.post(() -> {
                switch (result.outcome) {
                    case OFFLINE:
                        lastFailedUrl = target;
                        showOffline();
                        return;
                    case THROTTLED:
                        toastThrottled(result.retryAfter);
                        break;
                    case REJECTED:
                        toast(R.string.session_ended);
                        break;
                    default:
                        break;
                }
                // Signed in (device session) or not: the Console decides what to show
                // (its own sign-in page for no session, "no permission" for 403).
                sessionStarted = true;
                clearHistoryOnLoad = true;
                load(target);
            });
        });
    }

    private void showOffline() {
        holdSplash = false;
        load(LOCAL_OFFLINE);
    }

    /** After a Console page loads, turn a password sign-in into a device session. */
    private void maybeRegister(String url) {
        boolean afterLogin = cameFromLogin;
        cameFromLogin = policy.isLogin(url);
        if (!policy.isConsoleAdmin(url)) return;
        long now = SystemClock.elapsedRealtime();
        if (!afterLogin && (store.hasCredential() || now - lastRegisterAttempt < 30_000)) return;
        lastRegisterAttempt = now;

        worker.execute(() -> {
            SessionCoordinator.Result result = session.maybeRegister();
            main.post(() -> {
                if (result.outcome == SessionCoordinator.Outcome.DEVICE_LIMIT && !deviceLimitShown) {
                    deviceLimitShown = true;
                    toast(R.string.device_limit);
                } else if (result.outcome == SessionCoordinator.Outcome.THROTTLED) {
                    toastThrottled(result.retryAfter);
                }
            });
        });
    }

    /**
     * The device cookie (≤ 12 h) can end while the app is in use; the Console
     * then sends the user to /login. If a credential is still stored, renew
     * the session silently and return to the page (redirect limited to
     * Console routes). At most once per 30 s, so a refused credential can't loop.
     */
    private void restoreAtLogin(String loginUrl) {
        long now = SystemClock.elapsedRealtime();
        if (!store.hasCredential() || now - lastLoginRestore < 30_000) return;
        lastLoginRestore = now;

        String redirect = Uri.parse(loginUrl).getQueryParameter("redirect");
        String back = redirect != null && redirect.startsWith("/") ? consoleUrl(redirect) : null;
        String target = back != null && policy.isConsoleAdmin(back) ? back : consoleUrl("/admin");

        worker.execute(() -> {
            SessionCoordinator.Result result = session.restore();
            main.post(() -> {
                if (result.outcome == SessionCoordinator.Outcome.OK) load(target);
                else if (result.outcome == SessionCoordinator.Outcome.THROTTLED) toastThrottled(result.retryAfter);
                else if (result.outcome == SessionCoordinator.Outcome.REJECTED) toast(R.string.session_ended);
            });
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        if (!ready || !sessionStarted) return;
        String url = bridge.getWebView().getUrl();
        if (url == null || !policy.isConsoleAdmin(url)) return;
        long now = SystemClock.elapsedRealtime();
        if (now - lastResumeCheck < RESUME_CHECK_INTERVAL_MS) return;
        lastResumeCheck = now;

        worker.execute(() -> {
            SessionCoordinator.Result result = session.check();
            main.post(() -> onResumeChecked(result, url));
        });
    }

    private void onResumeChecked(SessionCoordinator.Result result, String url) {
        switch (result.outcome) {
            case RESTORED:
                load(url);
                break;
            case SIGNED_OUT:
            case REJECTED:
                // 401: back to the Console sign-in page, returning here afterwards.
                load(consoleUrl("/login?redirect=" + Uri.encode(pathOf(url))));
                break;
            case THROTTLED:
                toastThrottled(result.retryAfter);
                break;
            case OFFLINE:
                toast(R.string.offline);
                break;
            default:
                break;
        }
    }

    // ------------------------------------------------------------ WebView events

    @Override
    public void onPageLoaded(String url) {
        main.post(() -> {
            NavigationPolicy.Decision decision = policy.decide(url);
            if (decision == NavigationPolicy.Decision.CONSOLE) {
                holdSplash = false;
                if (clearHistoryOnLoad) {
                    // Back must not return to the loading / offline page.
                    clearHistoryOnLoad = false;
                    bridge.getWebView().clearHistory();
                }
                if (policy.isLogin(url)) restoreAtLogin(url);
                maybeRegister(url);
            } else if (LOCAL_OFFLINE.equals(url)) {
                holdSplash = false;
            }
        });
    }

    @Override
    public void onDeepLink(String link) {
        main.post(() -> {
            // The offline page's retry link: reopen what failed.
            String current = bridge.getWebView().getUrl();
            if (LOCAL_OFFLINE.equals(current) && lastFailedUrl != null) {
                startSession(lastFailedUrl);
                return;
            }
            open(resolve(link));
        });
    }

    @Override
    public void onExternal(Uri uri) {
        main.post(() -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(intent);
            } catch (ActivityNotFoundException e) {
                toast(R.string.no_app_for_link);
            }
        });
    }

    @Override
    public void onWebLogout() {
        session.onWebLogout();
    }

    @Override
    public void onMainFrameError(String url) {
        main.post(() -> {
            if (policy.decide(url) != NavigationPolicy.Decision.CONSOLE) return;
            lastFailedUrl = url;
            showOffline();
        });
    }

    // ------------------------------------------------------------ deep links

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // BridgeActivity also calls this from onCreate before the shell is set up.
        if (!ready) return;
        setIntent(intent);
        String target = targetFor(intent);
        if (target != null) open(target);
    }

    /** The Console URL an incoming intent asks for, or null if it carries no link. */
    private String targetFor(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getData() == null) return null;
        String link = intent.getDataString();
        if (policy.decide(link) != NavigationPolicy.Decision.DEEP_LINK) return null;
        return resolve(link);
    }

    /** Unknown or malformed links open the Console home (contract: src/lib/console-links.ts). */
    private String resolve(String link) {
        String web = resolver.toWebUrl(link);
        return web != null ? web : consoleUrl("/admin");
    }

    private void open(String target) {
        if (!sessionStarted) {
            startSession(target);
            return;
        }
        load(target);
    }

    // ------------------------------------------------------------ back

    private void goBack() {
        WebView webView = bridge.getWebView();
        String url = webView.getUrl();
        boolean atRoot = url == null
                || policy.decide(url) != NavigationPolicy.Decision.CONSOLE
                || policy.isLogin(url)
                || "/admin".equals(pathOf(url).replaceAll("\\?.*$", ""));
        if (atRoot) {
            moveTaskToBack(true);
        } else if (webView.canGoBack()) {
            webView.goBack();
        } else {
            load(consoleUrl("/admin"));
        }
    }

    // ------------------------------------------------------------ helpers

    private static String pathOf(String url) {
        try {
            URI uri = URI.create(url);
            String path = uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
            return uri.getRawQuery() == null ? path : path + "?" + uri.getRawQuery();
        } catch (IllegalArgumentException e) {
            return "/admin";
        }
    }

    private void toast(int message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private void toastThrottled(int retryAfterSeconds) {
        int minutes = Math.max(1, (int) Math.ceil(retryAfterSeconds / 60.0));
        Toast.makeText(this, getResources().getQuantityString(R.plurals.throttled_minutes, minutes, minutes), Toast.LENGTH_LONG).show();
    }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            throw new IllegalStateException("console-routes.txt missing — run npm run routes", e);
        }
    }

    @Override
    public void onDestroy() {
        worker.shutdown();
        super.onDestroy();
    }
}
