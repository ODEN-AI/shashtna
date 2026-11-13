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

const rows = [
  { id: 1, kind: "PROBLEM", service: "IPTV", title: "القنوات توكف", keywords: "تقطيع، توكف", content: "أعد تشغيل الراوتر.", isActive: true, sortOrder: 2 },
  { id: 2, kind: "PAYMENT", service: "ALL", title: "طريقة الدفع", keywords: "", content: "حوّل على حساب المصرف ثم ارفع الصورة.", isActive: true, sortOrder: 1 },
  { id: 3, kind: "PROBLEM", service: "VIP", title: "جهاز VIP ما يشتغل", keywords: "جهاز", content: "افصل الكهرباء دقيقة.", isActive: true, sortOrder: 0 },
  { id: 4, kind: "FAQ", service: "IPTV", title: "قديم", keywords: "تقطيع", content: "معطل", isActive: false, sortOrder: 0 },
];

test("playbook: the agent reads every active entry in full, in the owner's order", () => {
  const read = p.playbookForModel(rows);

  assert.equal(read.mode, "full");
  if (read.mode !== "full") return;
  assert.deepEqual(read.entries.map((entry) => entry.id), [3, 2, 1], "sortOrder, then id");
  assert.equal(read.entries.some((entry) => entry.id === 4), false, "disabled entries never reach the agent");
  assert.equal(read.entries.find((entry) => entry.id === 1)?.answer, "أعد تشغيل الراوتر.");
  assert.equal(read.entries.find((entry) => entry.id === 1)?.alsoCalled, "تقطيع، توكف");
  assert.equal("alsoCalled" in read.entries.find((entry) => entry.id === 2)!, false, "keywords are optional");
});

test("playbook: a service keeps its own entries and the ALL ones; IPTV and VIP never mix", () => {
  const vip = p.playbookForModel(rows, "VIP");
  const iptv = p.playbookForModel(rows, "iptv");

  assert.deepEqual(vip.entries.map((entry) => entry.id).sort(), [2, 3]);
  assert.deepEqual(iptv.entries.map((entry) => entry.id).sort(), [1, 2]);
});

test("playbook: a long playbook becomes an index the agent opens by id", () => {
  const long = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, kind: "PROBLEM", service: "ALL", title: `مشكلة ${i + 1}`, keywords: "", content: "خطوة ".repeat(80), isActive: true, sortOrder: i }));
  const read = p.playbookForModel(long);

  assert.equal(read.mode, "index");
  if (read.mode !== "index") return;
  assert.equal(read.entries.length, 40, "every problem is still listed");
  assert.ok(read.entries.every((entry) => entry.preview.length <= 90));
  assert.ok(JSON.stringify(read).length < 12_000, "fits the AI core's tool-result cap");
});
