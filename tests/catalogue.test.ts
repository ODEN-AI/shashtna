import assert from "node:assert/strict";
import { test } from "node:test";

const catalogue = await import("@/src/lib/catalogue");
const nav = await import("@/app/components/admin/nav");

test("prices are whole, non-negative dinars — never coerced", () => {
  assert.ok(catalogue.isValidPrice(0));
  assert.ok(catalogue.isValidPrice(35000));
  assert.ok(!catalogue.isValidPrice(-1));
  assert.ok(!catalogue.isValidPrice(1.5));
  assert.ok(!catalogue.isValidPrice("35000"), "a string is rejected, not converted");
  assert.ok(!catalogue.isValidPrice(null));
  assert.ok(!catalogue.isValidPrice(Number.NaN));
  assert.ok(!catalogue.isValidPrice(1e12));
});

test("image URLs: uploads and http(s) only", () => {
  assert.equal(catalogue.catalogueImageUrl(undefined), null);
  assert.equal(catalogue.catalogueImageUrl("  "), null);
  assert.equal(catalogue.catalogueImageUrl("/uploads/packages/a.png"), "/uploads/packages/a.png");
  assert.equal(catalogue.catalogueImageUrl("/api/uploads/packages/a.png"), "/api/uploads/packages/a.png");
  assert.equal(catalogue.catalogueImageUrl("https://cdn.example.com/a.webp"), "https://cdn.example.com/a.webp");
  assert.equal(catalogue.catalogueImageUrl("javascript:alert(1)"), false);
  assert.equal(catalogue.catalogueImageUrl("data:image/svg+xml;base64,AAA"), false);
  assert.equal(catalogue.catalogueImageUrl("//evil.example/a.png"), false);
  assert.equal(catalogue.catalogueImageUrl(42), false);
});

test("compatibility rule mirrors createOrder: only active VIP packages need a device", () => {
  assert.ok(catalogue.needsCompatibleDevice({ serviceType: "VIP", isActive: true }));
  assert.ok(catalogue.needsCompatibleDevice({ serviceType: "vip", isActive: true }));
  assert.ok(!catalogue.needsCompatibleDevice({ serviceType: "VIP", isActive: false }));
  assert.ok(!catalogue.needsCompatibleDevice({ serviceType: "IPTV", isActive: true }));
});

test("change descriptions for the audit log", () => {
  assert.deepEqual(catalogue.describeChanges({ price: 35000, isActive: true, name: "A" }, { price: 40000, isActive: true }, ["price", "isActive", "name"]), ["price: 35000 → 40000"]);
  assert.deepEqual(catalogue.describeLinks([1, 2], [2, 3]), { added: [3], removed: [1], changed: true });
  assert.equal(catalogue.describeLinks([2, 1], [1, 2]).changed, false);
});

test("URL query parsing is strict", () => {
  assert.deepEqual(catalogue.parseCatalogueQuery(catalogue.PACKAGE_VIEWS, {}), { q: "", view: "all", type: "all", page: 1 });
  assert.deepEqual(catalogue.parseCatalogueQuery(catalogue.PACKAGE_VIEWS, { q: " VIP ", view: "no-devices", type: "vip", page: "2" }), { q: "VIP", view: "no-devices", type: "VIP", page: 2 });
  assert.equal(catalogue.parseCatalogueQuery(catalogue.DEVICE_VIEWS, { view: "no-devices" }).view, "all", "views are per list");
  assert.equal(catalogue.parseCatalogueQuery(catalogue.PACKAGE_VIEWS, { type: "satellite", page: "-1" }).type, "all");
});

test("text search", () => {
  assert.ok(catalogue.matchesText("", "x"));
  assert.ok(catalogue.matchesText("vip", "VIP 3 أشهر"));
  assert.ok(!catalogue.matchesText("box", "IPTV سنة", "iptv-1y"));
  assert.ok(!catalogue.matchesText("#3", "#3 in a description"), "#id is matched by id, not text");
});

test("nav highlights the most specific item", () => {
  const hrefs = ["/admin", "/admin/catalogue", "/admin/catalogue/packages", "/admin/orders"];
  assert.equal(nav.activeHref("/admin/catalogue/packages/3", hrefs), "/admin/catalogue/packages");
  assert.equal(nav.activeHref("/admin/catalogue", hrefs), "/admin/catalogue");
  assert.equal(nav.activeHref("/admin", hrefs), "/admin");
  assert.equal(nav.activeHref("/admin/catalogue-x", hrefs), undefined);
});
