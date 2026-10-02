//! Same deep-link cases as tests/console-contract.test.ts and the Android
//! ConsoleShellTest, so the three implementations cannot drift apart.

use shashtna_console_core::links::{parse_order_number, DeepLinkResolver};
use shashtna_console_core::policy::{Decision, NavigationPolicy};
use shashtna_console_core::routes::ConsoleRoutes;

fn routes() -> ConsoleRoutes {
    ConsoleRoutes::bundled()
}

#[test]
fn route_table_is_the_generated_one() {
    let r = routes();
    assert_eq!(r.origin, "https://shashtna.netlify.app");
    assert_eq!(r.scheme, "shashtna-console");
    assert_eq!(r.patterns.len(), 50);
    assert!(r.patterns.iter().any(|p| p == "/admin/orders/:id"));
    assert!(r.patterns.iter().any(|p| p == "/admin/support/:uuid"));
    assert_eq!(
        r.query_keys,
        ["queue", "period", "from", "to", "view", "q", "status", "page", "scope"]
    );
    assert!(ConsoleRoutes::parse("route /admin").is_err());
}

#[test]
fn deep_links_map_one_to_one() {
    let r = routes();
    let links = DeepLinkResolver::new(&r);
    let cases = [
        ("shashtna-console://admin", "https://shashtna.netlify.app/admin"),
        (
            "shashtna-console://admin/operations?queue=payments",
            "https://shashtna.netlify.app/admin/operations?queue=payments",
        ),
        ("shashtna-console://admin/orders/42", "https://shashtna.netlify.app/admin/orders/42"),
        (
            "shashtna-console://admin/orders/SH-000042",
            "https://shashtna.netlify.app/admin/orders/42",
        ),
        (
            "shashtna-console://admin/customers/123",
            "https://shashtna.netlify.app/admin/customers/123",
        ),
        (
            "shashtna-console://admin/support/0f8fad5b-d9cb-469f-a165-70867728950e",
            "https://shashtna.netlify.app/admin/support/0f8fad5b-d9cb-469f-a165-70867728950e",
        ),
        (
            "shashtna-console://admin/intelligence/revenue?period=last30&evil=<x>",
            "https://shashtna.netlify.app/admin/intelligence/revenue?period=last30",
        ),
        (
            "shashtna-console://admin/intelligence/revenue?period=last30&evil=%3Cx%3E",
            "https://shashtna.netlify.app/admin/intelligence/revenue?period=last30",
        ),
        (
            "shashtna-console://admin/customers?q=%D8%A3%D8%AD%D9%85%D8%AF&page=2",
            "https://shashtna.netlify.app/admin/customers?q=%D8%A3%D8%AD%D9%85%D8%AF&page=2",
        ),
        (
            "shashtna-console://admin/customers?page=2&q=a+b",
            "https://shashtna.netlify.app/admin/customers?q=a+b&page=2",
        ),
        ("shashtna-console://admin/orders/", "https://shashtna.netlify.app/admin/orders"),
        (
            "shashtna-console://admin/customers/9999999999",
            "https://shashtna.netlify.app/admin/customers/9999999999",
        ),
    ];
    for (link, web) in cases {
        assert_eq!(links.to_web_url(link).as_deref(), Some(web), "{link}");
    }
}

#[test]
fn bad_deep_links_fall_back_to_home() {
    let r = routes();
    let links = DeepLinkResolver::new(&r);
    let bad = [
        "shashtna://admin",
        "https://shashtna.netlify.app/admin",
        "shashtna-console://admin/nope",
        "shashtna-console://admin/../etc/passwd",
        "shashtna-console://admin/orders/0",
        "shashtna-console://admin/orders/abc",
        "shashtna-console://admin/customers/1.5",
        "shashtna-console://user:pw@admin",
        "shashtna-console://dashboard",
        "shashtna-console://admin:8080/orders/1",
        "shashtna-console://admin/customers/10000000000",
        "shashtna-console://admin//orders",
        "javascript:alert(1)",
        "not a url",
        "",
    ];
    for link in bad {
        assert_eq!(links.to_web_url(link), None, "{link}");
        assert_eq!(links.target_or_home(link), "https://shashtna.netlify.app/admin", "{link}");
    }
    let long = format!("shashtna-console://admin/customers?q={}", "a".repeat(101));
    assert_eq!(
        links.to_web_url(&long).as_deref(),
        Some("https://shashtna.netlify.app/admin/customers")
    );
}

#[test]
fn order_numbers_mirror_the_web_parser() {
    assert_eq!(parse_order_number("SH-000042"), Some(42));
    assert_eq!(parse_order_number(" sh-42 "), Some(42));
    assert_eq!(parse_order_number("42"), Some(42));
    assert_eq!(parse_order_number("000"), Some(0));
    assert_eq!(parse_order_number("SH-"), None);
    assert_eq!(parse_order_number("XX-42"), None);
    assert_eq!(parse_order_number("1234567890"), None);
}

#[test]
fn navigation_policy() {
    let r = routes();
    let p = NavigationPolicy::new(&r);
    use Decision::*;
    let cases = [
        ("https://shashtna.netlify.app/admin/orders/1", Console),
        ("https://SHASHTNA.netlify.app/login?redirect=/admin", Console),
        ("https://shashtna.netlify.app:443/admin", Console),
        ("https://tauri.localhost/offline.html", Local),
        ("tauri://localhost/index.html", Local),
        ("shashtna-console://admin/orders/1", DeepLink),
        ("https://wa.me/9647700000000", External),
        ("https://example.com/", External),
        ("mailto:support@example.com", External),
        ("tel:+9647700000000", External),
        ("https://shashtna.netlify.app.evil.example/admin", External),
        ("https://evil-shashtna.netlify.app/admin", External),
        ("http://shashtna.netlify.app/admin", Block),
        ("http://example.com/", Block),
        ("https://shashtna.netlify.app:8443/admin", Block),
        ("https://user@shashtna.netlify.app/admin", Block),
        ("https://user:pw@example.com/", Block),
        ("https://tauri.localhost:8080/", Block),
        ("javascript:alert(1)", Block),
        ("file:///C:/Users/x/AppData/Local/com.shashtna.console", Block),
        ("data:text/html,<b>x</b>", Block),
        ("blob:https://shashtna.netlify.app/1234", Block),
        ("about:blank", Block),
        ("ms-settings:privacy", Block),
        ("whatsapp://send?phone=1", Block),
        ("", Block),
        ("not a url", Block),
    ];
    for (url, want) in cases {
        assert_eq!(p.decide(url), want, "{url}");
    }
}

#[test]
fn admin_login_and_home_pages() {
    let r = routes();
    let p = NavigationPolicy::new(&r);
    assert!(p.is_console_admin("https://shashtna.netlify.app/admin"));
    assert!(p.is_console_admin("https://shashtna.netlify.app/admin/customers/7?period=last30"));
    assert!(!p.is_console_admin("https://shashtna.netlify.app/administrator"));
    assert!(!p.is_console_admin("https://shashtna.netlify.app/dashboard"));
    assert!(!p.is_console_admin("https://evil.example/admin"));
    assert!(p.is_login("https://shashtna.netlify.app/login?redirect=/admin"));
    assert!(!p.is_login("https://evil.example/login"));
    assert!(p.is_console_home("https://shashtna.netlify.app/admin?x=1"));
    assert!(!p.is_console_home("https://shashtna.netlify.app/admin/orders"));
}
