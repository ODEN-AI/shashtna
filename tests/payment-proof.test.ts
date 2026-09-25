import assert from "node:assert/strict";
import { test } from "node:test";

const proof = await import("@/src/lib/payment-proof");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0x24, 0, 0, 0, ...Buffer.from("WEBPVP8 ")]);

test("payment proofs are recognised by their bytes, not their name", () => {
  assert.equal(proof.sniffProofType(JPEG), "image/jpeg");
  assert.equal(proof.sniffProofType(PNG), "image/png");
  assert.equal(proof.sniffProofType(WEBP), "image/webp");
  assert.equal(proof.sniffProofType(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assert.equal(proof.sniffProofType(new TextEncoder().encode("%PDF-1.7")), null);
});

test("payment proof checks give customer-facing errors", () => {
  assert.deepEqual(proof.checkProofBytes(JPEG), { ok: true, contentType: "image/jpeg" });

  const empty = proof.checkProofBytes(new Uint8Array());
  assert.equal(empty.ok, false);
  assert.equal(!empty.ok && empty.error, "يرجى رفع صورة إثبات الدفع.");

  const html = proof.checkProofBytes(new TextEncoder().encode("<html>"));
  assert.equal(html.ok, false);

  const huge = new Uint8Array(proof.PROOF_MAX_BYTES + 1);
  huge.set(JPEG);
  assert.equal(proof.checkProofBytes(huge).ok, false);
});
