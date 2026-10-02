package com.shashtna.console;

import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Every navigation in the shell goes through {@link NavigationPolicy}:
 * only the Console origin (and the shell's bundled pages) load inside the
 * WebView; other sites, phone, mail and WhatsApp links open outside;
 * javascript:, file:, intent: and cleartext Console URLs are dropped.
 *
 * It also notices the Console's own sign-out request so the shell can end
 * the device session and forget the stored credential.
 */
final class ConsoleWebViewClient extends BridgeWebViewClient {
    interface Listener {
        /** A main-frame page finished loading. */
        void onPageLoaded(String url);

        /** shashtna-console://… was opened from a page. */
        void onDeepLink(String link);

        /** An outside link the user opened (browser, dialer, mail, WhatsApp). */
        void onExternal(Uri uri);

        /** The Console's sign-out POST is about to be sent. Runs on a WebView I/O thread. */
        void onWebLogout();

        /** The main frame failed to load (no connection, DNS, timeout). */
        void onMainFrameError(String url);
    }

    private final NavigationPolicy policy;
    private final String logoutUrl;
    private final Listener listener;

    ConsoleWebViewClient(Bridge bridge, NavigationPolicy policy, String origin, Listener listener) {
        super(bridge);
        this.policy = policy;
        this.logoutUrl = origin + "/api/auth/logout";
        this.listener = listener;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        switch (policy.decide(url)) {
            case CONSOLE:
            case LOCAL:
                return false;
            case DEEP_LINK:
                listener.onDeepLink(url);
                return true;
            case EXTERNAL:
                // Only a user action in the page itself may leave the app.
                if (request.isForMainFrame() || request.hasGesture()) listener.onExternal(request.getUrl());
                return true;
            case BLOCK:
            default:
                return true;
        }
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        if ("POST".equalsIgnoreCase(request.getMethod()) && (url.equals(logoutUrl) || url.startsWith(logoutUrl + "?"))) {
            // Blocks this I/O thread until the device session has ended, then lets
            // the Console's own request through unchanged (it clears the cookie).
            listener.onWebLogout();
        }
        return super.shouldInterceptRequest(view, request);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        listener.onPageLoaded(url);
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        super.onReceivedError(view, request, error);
        if (request.isForMainFrame()) listener.onMainFrameError(request.getUrl().toString());
    }
}
