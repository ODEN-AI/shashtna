import assert from "node:assert/strict";
import { test } from "node:test";

const { loadSection } = await import("@/src/lib/dashboard-section");

test("a section the role can't access is never loaded", async () => {
  let called = false;
  const result = await loadSection(false, "TEST", async () => {
    called = true;
    return 42;
  });

  assert.equal(result, null);
  assert.equal(called, false);
});

test("a failed section is reported as unavailable, not as zero", async () => {
  const original = console.error;
  console.error = () => {};

  try {
    const result = await loadSection(true, "TEST", async () => {
      throw new Error("db down");
    });

    assert.deepEqual(result, { ok: false });
  } finally {
    console.error = original;
  }
});

test("a loaded section carries its real data, including a real zero", async () => {
  assert.deepEqual(await loadSection(true, "TEST", async () => 0), { ok: true, data: 0 });
  assert.deepEqual(await loadSection(true, "TEST", async () => ({ total: 7 })), { ok: true, data: { total: 7 } });
});
