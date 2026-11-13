import assert from "node:assert/strict";
import { test } from "node:test";

const p = await import("@/src/lib/playbook");

const base = { kind: "PROBLEM", service: "IPTV", title: "القنوات توكف", keywords: "تقطيع، توكف, freeze", content: "أعد تشغيل الراوتر ثم التطبيق.", sortOrder: "0", isActive: "on" };

test("playbook: valid entries pass, cleaned", () => {
  const result = p.checkPlaybookEntry({ ...base, title: "  القنوات   توكف ", keywords: "تقطيع، توكف, freeze, توكف" });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.title, "القنوات توكف");
  assert.equal(result.value.keywords, "تقطيع، توكف، freeze");
  assert.equal(result.value.isActive, true);
  assert.equal(result.value.sortOrder, 0);
});

test("playbook: invalid entries are refused with Arabic errors", () => {
  assert.equal(p.checkPlaybookEntry({ ...base, kind: "OTHER" }).ok, false);
  assert.equal(p.checkPlaybookEntry({ ...base, service: "NETFLIX" }).ok, false);
  assert.equal(p.checkPlaybookEntry({ ...base, title: "x" }).ok, false);
  assert.equal(p.checkPlaybookEntry({ ...base, content: "قصير" }).ok, false);
  assert.equal(p.checkPlaybookEntry({ ...base, content: "x".repeat(4001) }).ok, false);
  assert.equal(p.checkPlaybookEntry({ ...base, sortOrder: "-1" }).ok, false);
  assert.equal(p.checkPlaybookEntry({ ...base, sortOrder: "1.5" }).ok, false);
  assert.equal(p.checkPlaybookEntry({ ...base, isActive: "yes" }).ok, false);
  const bad = p.checkPlaybookEntry({ ...base, kind: "x" });
  if (!bad.ok) assert.match(bad.error, /[؀-ۿ]/);
});

test("playbook: keywords are split on commas, Arabic commas and lines", () => {
  assert.deepEqual(p.parseKeywords("أ، ب,ج\nد ، أ"), ["أ", "ب", "ج", "د"]);
  assert.deepEqual(p.parseKeywords(""), []);
});

test("playbook: Arabic matching ignores tashkeel and letter forms", () => {
  assert.equal(p.normalizeForMatch("الإشتِراك منتهيّة"), "الاشتراك منتهيه");
  assert.equal(p.normalizeForMatch("مـــرحبا!"), "مرحبا");
});

const rows = [
  { id: 1, kind: "PROBLEM", service: "IPTV", title: "القنوات توكف", keywords: "تقطيع، توكف", content: "أعد تشغيل الراوتر.", isActive: true, sortOrder: 0 },
  { id: 2, kind: "PAYMENT", service: "ALL", title: "طريقة الدفع", keywords: "دفع، تحويل، حساب", content: "حوّل على حساب المصرف ثم ارفع الصورة.", isActive: true, sortOrder: 0 },
  { id: 3, kind: "PROBLEM", service: "VIP", title: "جهاز VIP ما يشتغل", keywords: "جهاز", content: "افصل الكهرباء دقيقة.", isActive: true, sortOrder: 0 },
  { id: 4, kind: "FAQ", service: "IPTV", title: "قديم", keywords: "تقطيع", content: "معطل", isActive: false, sortOrder: 0 },
];

test("playbook: search ranks keyword hits first and never returns disabled entries", () => {
  assert.deepEqual(p.searchPlaybook(rows, "القنوات دا تقطّع عندي").map((row) => row.id), [1]);
  assert.deepEqual(p.searchPlaybook(rows, "شلون أحوّل الفلوس؟ وين الحساب").map((row) => row.id), [2]);
  assert.equal(p.searchPlaybook(rows, "تقطيع").some((row) => row.id === 4), false, "disabled entry hidden");
});

test("playbook: service filter keeps that service and ALL entries", () => {
  assert.deepEqual(p.searchPlaybook(rows, "", { service: "VIP" }).map((row) => row.id).sort(), [2, 3]);
  assert.deepEqual(p.searchPlaybook(rows, "جهاز", { service: "IPTV" }).map((row) => row.id), []);
  assert.deepEqual(p.searchPlaybook(rows, "", { kind: "PAYMENT" }).map((row) => row.id), [2]);
});
