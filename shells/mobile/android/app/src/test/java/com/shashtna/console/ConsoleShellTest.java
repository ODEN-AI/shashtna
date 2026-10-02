package com.shashtna.console;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.BeforeClass;
import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * JVM tests for the pure parts of the shell. The deep-link cases are the same
 * as tests/console-contract.test.ts, so the native resolver and the web
 * contract (src/lib/console-links.ts) cannot drift apart.
 */
public class ConsoleShellTest {
    private static ConsoleRoutes routes;
    private static DeepLinkResolver links;
    private static NavigationPolicy policy;

    @BeforeClass
    public static void load() throws Exception {
        Path asset = Paths.get("src/main/assets/console-routes.txt");
        if (!Files.exists(asset)) asset = Paths.get(System.getProperty("console.routes", "app/src/main/assets/console-routes.txt"));
        routes = ConsoleRoutes.parse(new String(Files.readAllBytes(asset), StandardCharsets.UTF_8));
        links = new DeepLinkResolver(routes);
        policy = new NavigationPolicy(routes);
    }

    @Test
    public void routesTableIsGenerated() {
        assertEquals("https://shashtna.netlify.app", routes.origin);
        assertEquals("shashtna-console", routes.scheme);
        assertEquals(50, routes.patterns.size());
        assertTrue(routes.patterns.contains("/admin/orders/:id"));
        assertTrue(routes.patterns.contains("/admin/support/:uuid"));
        assertEquals(9, routes.queryKeys.size());
    }

    @Test
    public void deepLinksMapOneToOne() {
        String[][] map = {
            {"shashtna-console://admin", "https://shashtna.netlify.app/admin"},
            {"shashtna-console://admin/operations?queue=payments", "https://shashtna.netlify.app/admin/operations?queue=payments"},
            {"shashtna-console://admin/orders/42", "https://shashtna.netlify.app/admin/orders/42"},
            {"shashtna-console://admin/orders/SH-000042", "https://shashtna.netlify.app/admin/orders/42"},
            {"shashtna-console://admin/customers/123", "https://shashtna.netlify.app/admin/customers/123"},
            {"shashtna-console://admin/support/0f8fad5b-d9cb-469f-a165-70867728950e", "https://shashtna.netlify.app/admin/support/0f8fad5b-d9cb-469f-a165-70867728950e"},
            {"shashtna-console://admin/intelligence/revenue?period=last30&evil=%3Cx%3E", "https://shashtna.netlify.app/admin/intelligence/revenue?period=last30"},
            {"shashtna-console://admin/customers?q=%D8%A3%D8%AD%D9%85%D8%AF&page=2", "https://shashtna.netlify.app/admin/customers?q=%D8%A3%D8%AD%D9%85%D8%AF&page=2"},
            {"shashtna-console://admin/orders/", "https://shashtna.netlify.app/admin/orders"},
            {"shashtna-console://admin/customers/9999999999", "https://shashtna.netlify.app/admin/customers/9999999999"},
        };
        for (String[] pair : map) assertEquals(pair[0], pair[1], links.toWebUrl(pair[0]));
    }

    @Test
    public void badDeepLinksAreRejected() {
        String[] bad = {
            "shashtna://admin", "https://shashtna.netlify.app/admin", "shashtna-console://admin/nope",
            "shashtna-console://admin/../etc/passwd", "shashtna-console://admin/orders/0", "shashtna-console://admin/orders/abc",
            "shashtna-console://admin/customers/1.5", "shashtna-console://user:pw@admin", "shashtna-console://dashboard",
            "shashtna-console://admin:8080/orders/1", "shashtna-console://admin/customers/10000000000",
            "shashtna-console://admin//orders", "not a url", "", null,
        };
        for (String link : bad) assertNull(String.valueOf(link), links.toWebUrl(link));
    }

    @Test
    public void longQueryValuesAreDropped() {
        StringBuilder value = new StringBuilder();
        for (int i = 0; i < 101; i++) value.append('a');
        assertEquals("https://shashtna.netlify.app/admin/customers", links.toWebUrl("shashtna-console://admin/customers?q=" + value));
    }

    @Test
    public void navigationPolicy() {
        assertEquals(NavigationPolicy.Decision.CONSOLE, policy.decide("https://shashtna.netlify.app/admin/orders/1"));
        assertEquals(NavigationPolicy.Decision.CONSOLE, policy.decide("https://SHASHTNA.netlify.app/login?redirect=/admin"));
        assertEquals(NavigationPolicy.Decision.LOCAL, policy.decide("https://localhost/offline.html"));
        assertEquals(NavigationPolicy.Decision.DEEP_LINK, policy.decide("shashtna-console://admin/orders/1"));
        assertEquals(NavigationPolicy.Decision.EXTERNAL, policy.decide("https://wa.me/9647700000000"));
        assertEquals(NavigationPolicy.Decision.EXTERNAL, policy.decide("https://example.com/"));
        assertEquals(NavigationPolicy.Decision.EXTERNAL, policy.decide("tel:+9647700000000"));
        assertEquals(NavigationPolicy.Decision.EXTERNAL, policy.decide("mailto:support@example.com"));
        assertEquals(NavigationPolicy.Decision.EXTERNAL, policy.decide("whatsapp://send?phone=1"));
        // Lookalike hosts are other sites, never the Console.
        assertEquals(NavigationPolicy.Decision.EXTERNAL, policy.decide("https://shashtna.netlify.app.evil.example/admin"));
        assertEquals(NavigationPolicy.Decision.EXTERNAL, policy.decide("https://evil-shashtna.netlify.app/admin"));
        String[] blocked = {
            "http://shashtna.netlify.app/admin", "https://shashtna.netlify.app:8443/admin", "https://user@shashtna.netlify.app/admin",
            "javascript:alert(1)", "file:///data/data/com.shashtna.console/shared_prefs/x.xml", "content://x/y",
            "intent://scan/#Intent;scheme=zxing;end", "data:text/html,<b>x</b>", "http://localhost/", "", null,
        };
        for (String url : blocked) assertEquals(String.valueOf(url), NavigationPolicy.Decision.BLOCK, policy.decide(url));
    }

    @Test
    public void adminAndLoginPages() {
        assertTrue(policy.isConsoleAdmin("https://shashtna.netlify.app/admin"));
        assertTrue(policy.isConsoleAdmin("https://shashtna.netlify.app/admin/customers/7?period=last30"));
        assertFalse(policy.isConsoleAdmin("https://shashtna.netlify.app/administrator"));
        assertFalse(policy.isConsoleAdmin("https://shashtna.netlify.app/dashboard"));
        assertFalse(policy.isConsoleAdmin("https://evil.example/admin"));
        assertTrue(policy.isLogin("https://shashtna.netlify.app/login?redirect=/admin"));
        assertFalse(policy.isLogin("https://evil.example/login"));
    }

    @Test
    public void orderNumbersMirrorTheWebParser() {
        assertEquals(Integer.valueOf(42), DeepLinkResolver.parseOrderNumber("SH-000042"));
        assertEquals(Integer.valueOf(42), DeepLinkResolver.parseOrderNumber(" sh-42 "));
        assertEquals(Integer.valueOf(42), DeepLinkResolver.parseOrderNumber("42"));
        assertNull(DeepLinkResolver.parseOrderNumber("SH-"));
        assertNull(DeepLinkResolver.parseOrderNumber("XX-42"));
    }
}
