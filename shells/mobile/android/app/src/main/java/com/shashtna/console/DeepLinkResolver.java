package com.shashtna.console;

import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * shashtna-console://admin/... → canonical Console web URL, with the same
 * rules as src/lib/console-links.ts (deepLinkToWebUrl): existing routes only,
 * ":id" a positive integer (orders also accept SH-000042), ":uuid" a ticket
 * id, only page-relevant query keys, no traversal, no user/port. Anything
 * else → null (the shell opens /admin). Pure Java (unit-tested on the JVM).
 */
public final class DeepLinkResolver {
    private static final Pattern ID = Pattern.compile("^[1-9]\\d{0,9}$");
    private static final Pattern UUID = Pattern.compile("^[A-Za-z0-9-]{8,64}$");
    private static final Pattern ORDER_NUMBER = Pattern.compile("^(?:SH-)?0*(\\d{1,9})$");

    private final ConsoleRoutes routes;

    public DeepLinkResolver(ConsoleRoutes routes) {
        this.routes = routes;
    }

    /** Mirrors parseOrderNumber (src/lib/order-status.ts). */
    static Integer parseOrderNumber(String value) {
        Matcher match = ORDER_NUMBER.matcher(value.trim().toUpperCase(java.util.Locale.ROOT));
        return match.matches() ? Integer.valueOf(match.group(1)) : null;
    }

    /** The canonical /admin path for a candidate path, or null. */
    public String canonicalPath(String path) {
        String clean = path.replaceAll("/+$", "");
        if (clean.isEmpty()) clean = "/";
        if (clean.contains("..") || clean.contains("//")) return null;
        String[] parts = clean.split("/", -1);

        for (String pattern : routes.patterns) {
            String[] want = pattern.split("/", -1);
            if (want.length != parts.length) continue;
            StringBuilder out = new StringBuilder();
            boolean ok = true;
            for (int i = 0; i < want.length && ok; i++) {
                String w = want[i];
                String got = parts[i];
                String segment = got;
                if (w.equals(":id")) {
                    Long id;
                    if (pattern.startsWith("/admin/orders/")) {
                        Integer order = parseOrderNumber(got);
                        id = order == null ? null : order.longValue();
                    } else {
                        id = ID.matcher(got).matches() ? Long.valueOf(got) : null;
                    }
                    ok = id != null && ID.matcher(String.valueOf(id)).matches();
                    segment = String.valueOf(id);
                } else if (w.equals(":uuid")) {
                    ok = UUID.matcher(got).matches();
                } else {
                    ok = w.equals(got);
                }
                if (i > 0) out.append('/');
                out.append(segment);
            }
            if (ok) return out.toString();
        }
        return null;
    }

    private String keptQuery(String rawQuery) {
        if (rawQuery == null || rawQuery.isEmpty()) return "";
        Map<String, String> found = new LinkedHashMap<>();
        for (String pair : rawQuery.split("&")) {
            int eq = pair.indexOf('=');
            String key = decode(eq < 0 ? pair : pair.substring(0, eq));
            String value = eq < 0 ? "" : decode(pair.substring(eq + 1));
            if (key != null && value != null && !found.containsKey(key)) found.put(key, value);
        }
        StringBuilder out = new StringBuilder();
        for (String key : routes.queryKeys) {
            String value = found.get(key);
            if (value == null || value.length() > 100) continue;
            out.append(out.length() == 0 ? '?' : '&').append(encode(key)).append('=').append(encode(value));
        }
        return out.toString();
    }

    /** Console path (+ kept query) for a shashtna-console:// link, or null. */
    public String toConsolePath(String link) {
        if (link == null) return null;
        URI uri;
        try {
            uri = new URI(link);
        } catch (URISyntaxException e) {
            return null;
        }
        if (!routes.scheme.equalsIgnoreCase(String.valueOf(uri.getScheme()))) return null;
        if (uri.getRawUserInfo() != null || uri.getPort() != -1 || uri.getHost() == null) return null;
        String rawPath = uri.getRawPath() == null ? "" : uri.getRawPath();
        String path = canonicalPath("/" + uri.getHost() + ("/".equals(rawPath) ? "" : rawPath));
        return path == null ? null : path + keptQuery(uri.getRawQuery());
    }

    /** The canonical web URL a deep link opens (what the shell loads), or null. */
    public String toWebUrl(String link) {
        String path = toConsolePath(link);
        return path == null ? null : routes.origin + path;
    }

    private static String decode(String value) {
        try {
            return URLDecoder.decode(value, "UTF-8");
        } catch (UnsupportedEncodingException | IllegalArgumentException e) {
            return null;
        }
    }

    private static String encode(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
