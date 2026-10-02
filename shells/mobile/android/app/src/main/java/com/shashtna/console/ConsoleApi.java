package com.shashtna.console;

import android.webkit.CookieManager;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Minimal native HTTP client for /api/console/v1 (the Phase 10A/10B contract,
 * see src/lib/console-api.ts and src/lib/console-client.ts). It runs in the
 * native layer so the device credential never enters the WebView.
 *
 * Requests carry the WebView's own session cookie (CookieManager), so the
 * server sees the same session as the Console page. Bodies and credentials
 * are never logged. No Origin header is sent (native requests are not
 * cross-site), matching the server's Phase 10A origin rule.
 */
final class ConsoleApi {
    static final int NETWORK_ERROR = 0;
    private static final int TIMEOUT_MS = 15_000;

    static final class Result {
        final int status;
        final JSONObject body;
        final int retryAfter;
        final List<String> setCookies;

        Result(int status, JSONObject body, int retryAfter, List<String> setCookies) {
            this.status = status;
            this.body = body;
            this.retryAfter = retryAfter;
            this.setCookies = setCookies;
        }

        boolean ok() {
            return status >= 200 && status < 300;
        }

        String code() {
            return body.optString("code", "");
        }
    }

    private final String origin;

    ConsoleApi(String origin) {
        this.origin = origin;
    }

    Result get(String path) {
        return send("GET", path, null);
    }

    Result post(String path, JSONObject body) {
        return send("POST", path, body == null ? new JSONObject() : body);
    }

    private Result send(String method, String path, JSONObject body) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(origin + "/api/console/v1" + path);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(TIMEOUT_MS);
            connection.setReadTimeout(TIMEOUT_MS);
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Cache-Control", "no-store");
            String cookie = CookieManager.getInstance().getCookie(origin);
            if (cookie != null && !cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);

            if (body != null) {
                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setFixedLengthStreamingMode(payload.length);
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(payload);
                }
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            JSONObject json = new JSONObject();
            if (stream != null) {
                try (InputStream in = stream) {
                    String text = read(in);
                    if (!text.isEmpty() && text.trim().startsWith("{")) json = new JSONObject(text);
                } catch (Exception ignored) {
                    json = new JSONObject();
                }
            }

            int retryAfter = json.optInt("retryAfter", 0);
            if (retryAfter <= 0) {
                try {
                    retryAfter = Integer.parseInt(String.valueOf(connection.getHeaderField("Retry-After")));
                } catch (NumberFormatException ignored) {
                    retryAfter = 0;
                }
            }

            List<String> cookies = new ArrayList<>();
            for (Map.Entry<String, List<String>> header : connection.getHeaderFields().entrySet()) {
                if (header.getKey() != null && header.getKey().equalsIgnoreCase("Set-Cookie")) cookies.addAll(header.getValue());
            }

            return new Result(status, json, retryAfter, cookies);
        } catch (IOException e) {
            return new Result(NETWORK_ERROR, new JSONObject(), 0, new ArrayList<>());
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    /** Put the server's session cookie into the WebView's cookie store (HttpOnly/Secure preserved). */
    void applyCookies(List<String> setCookies) {
        CookieManager manager = CookieManager.getInstance();
        for (String header : setCookies) manager.setCookie(origin, header);
        manager.flush();
    }

    private static String read(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int n;
        int total = 0;
        while ((n = in.read(buffer)) != -1) {
            total += n;
            if (total > 256 * 1024) break; // Console API bodies are small.
            out.write(buffer, 0, n);
        }
        return out.toString("UTF-8");
    }
}
