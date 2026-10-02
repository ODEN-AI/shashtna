package com.shashtna.console;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * What the shell does with a navigation. Pure Java (unit-tested on the JVM).
 *
 *  CONSOLE   — https on the Console origin: load in the shell.
 *  LOCAL     — the shell's own bundled pages (Capacitor https://localhost).
 *  DEEP_LINK — shashtna-console://… : resolve through the deep-link table.
 *  EXTERNAL  — another https/http site, tel:, mailto:, sms:, WhatsApp: hand
 *              to the system (browser / dialer / app); never inside the shell.
 *  BLOCK     — anything else (javascript:, file:, content:, intent:, data:,
 *              plain-http Console, malformed): ignored.
 */
public final class NavigationPolicy {
    public enum Decision { CONSOLE, LOCAL, DEEP_LINK, EXTERNAL, BLOCK }

    public static final String LOCAL_HOST = "localhost";

    private final String consoleHost;
    private final String scheme;

    public NavigationPolicy(ConsoleRoutes routes) {
        this.consoleHost = URI.create(routes.origin).getHost().toLowerCase(Locale.ROOT);
        this.scheme = routes.scheme.toLowerCase(Locale.ROOT);
    }

    public Decision decide(String url) {
        if (url == null || url.isEmpty()) return Decision.BLOCK;
        URI uri;
        try {
            uri = new URI(url.trim());
        } catch (URISyntaxException e) {
            return Decision.BLOCK;
        }
        String s = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);

        if (s.equals(scheme)) return Decision.DEEP_LINK;
        if (s.equals("https")) {
            if (uri.getRawUserInfo() != null) return Decision.BLOCK;
            boolean defaultPort = uri.getPort() == -1 || uri.getPort() == 443;
            if (host.equals(consoleHost)) return defaultPort ? Decision.CONSOLE : Decision.BLOCK;
            if (host.equals(LOCAL_HOST)) return defaultPort ? Decision.LOCAL : Decision.BLOCK;
            return host.isEmpty() ? Decision.BLOCK : Decision.EXTERNAL;
        }
        if (s.equals("http")) {
            // Never load cleartext in the shell; the Console itself is HTTPS-only.
            if (host.isEmpty() || host.equals(consoleHost) || host.equals(LOCAL_HOST)) return Decision.BLOCK;
            return Decision.EXTERNAL;
        }
        if (s.equals("tel") || s.equals("mailto") || s.equals("sms") || s.equals("whatsapp")) return Decision.EXTERNAL;
        return Decision.BLOCK;
    }

    /** True for a URL on the Console origin whose path is under /admin (or /admin itself). */
    public boolean isConsoleAdmin(String url) {
        if (decide(url) != Decision.CONSOLE) return false;
        String path = URI.create(url).getPath();
        return path != null && (path.equals("/admin") || path.startsWith("/admin/"));
    }

    /** The Console sign-in page (where an expired session lands). */
    public boolean isLogin(String url) {
        if (decide(url) != Decision.CONSOLE) return false;
        String path = URI.create(url).getPath();
        return "/login".equals(path);
    }
}
