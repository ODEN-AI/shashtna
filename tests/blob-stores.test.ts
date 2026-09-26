import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const { BLOB_STORES, blobNamespace, blobStoreName, imageReadStoreNames } = await import("@/src/lib/blob-stores");

const ORIGINAL = ["shashtna-payment-proofs", "shashtna-support", "shashtna-media", "shashtna-package-images"];
const ALL = Object.values(BLOB_STORES);

test("the registry holds exactly the store names production already uses", () => {
  assert.deepEqual([...ALL].sort(), [...ORIGINAL].sort());
});

test("unset or empty namespace => existing names, unchanged", () => {
  for (const env of [{}, { SHASHTNA_BLOB_NAMESPACE: "" }, { SHASHTNA_BLOB_NAMESPACE: "   " }]) {
    assert.equal(blobNamespace(env), null);
    for (const store of ALL) {
      assert.equal(blobStoreName(store, env), store);
    }
    assert.deepEqual(imageReadStoreNames(BLOB_STORES.media, env), ["shashtna-media"]);
    assert.deepEqual(imageReadStoreNames(BLOB_STORES.packageImages, env), ["shashtna-package-images"]);
  }
});

test("mobile-test => deterministic isolated names", () => {
  const env = { SHASHTNA_BLOB_NAMESPACE: "mobile-test" };
  assert.equal(blobStoreName(BLOB_STORES.paymentProofs, env), "mobile-test--shashtna-payment-proofs");
  assert.equal(blobStoreName(BLOB_STORES.support, env), "mobile-test--shashtna-support");
  assert.equal(blobStoreName(BLOB_STORES.media, env), "mobile-test--shashtna-media");
  assert.equal(blobStoreName(BLOB_STORES.packageImages, env), "mobile-test--shashtna-package-images");
  // Same input, same output.
  assert.equal(blobStoreName(BLOB_STORES.support, env), blobStoreName(BLOB_STORES.support, { ...env }));
  // Surrounding whitespace in the variable is ignored.
  assert.equal(blobStoreName(BLOB_STORES.support, { SHASHTNA_BLOB_NAMESPACE: " mobile-test " }), "mobile-test--shashtna-support");
});

test("no accidental double prefixing", () => {
  const env = { SHASHTNA_BLOB_NAMESPACE: "mobile-test" };
  for (const store of ALL) {
    const once = blobStoreName(store, env);
    const twice = blobStoreName(once as typeof store, env);
    assert.equal(twice, once);
    assert.equal(once.split("mobile-test--").length, 2);
  }
});

test("namespaced names stay valid Netlify Blobs store names (<= 64 bytes, no '/')", () => {
  const env = { SHASHTNA_BLOB_NAMESPACE: "a".repeat(32) };
  for (const store of ALL) {
    const name = blobStoreName(store, env);
    assert.ok(new TextEncoder().encode(name).length <= 64, name);
    assert.ok(!name.includes("/"));
  }
});

test("invalid namespaces fail loudly instead of writing to the shared stores", () => {
  for (const value of ["Mobile-Test", "mobile/test", "mobile--test", "-mobile", "a".repeat(33), "mobile test", "mobile_test"]) {
    assert.throws(() => blobStoreName(BLOB_STORES.support, { SHASHTNA_BLOB_NAMESPACE: value }), /SHASHTNA_BLOB_NAMESPACE/, value);
  }
});

test("only image reads fall back to the shared store, and only when namespaced", () => {
  const env = { SHASHTNA_BLOB_NAMESPACE: "mobile-test" };
  assert.deepEqual(imageReadStoreNames(BLOB_STORES.media, env), ["mobile-test--shashtna-media", "shashtna-media"]);
  assert.deepEqual(imageReadStoreNames(BLOB_STORES.packageImages, env), ["mobile-test--shashtna-package-images", "shashtna-package-images"]);
});

// ------------------------------------------------------------ static guard

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|mts)$/.test(entry) ? [full] : [];
  });
}

test("every getStore() call in the app goes through the namespacing helper", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const files = [...sourceFiles(path.join(root, "app")), ...sourceFiles(path.join(root, "src")), ...sourceFiles(path.join(root, "netlify"))];
  const calls: string[] = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/getStore\(([\s\S]{0,80}?)[),]/g)) {
      calls.push(`${path.relative(root, file)}: ${match[1].trim()}`);
    }
    // No hard-coded store names left anywhere outside the registry.
    if (!file.endsWith(path.join("src", "lib", "blob-stores.ts"))) {
      for (const name of ORIGINAL) {
        assert.ok(!text.includes(`"${name}"`), `${path.relative(root, file)} hard-codes ${name}`);
      }
    }
    assert.ok(!/getDeployStore\(/.test(text), `${file} uses getDeployStore`);
  }

  assert.equal(calls.length, 9, calls.join("\n"));
  for (const call of calls) {
    assert.ok(/^[^:]+: (blobStoreName\(|name\b|\{)/.test(call), `unexpected getStore argument: ${call}`);
  }
  const objectCalls = calls.filter((call) => /^[^:]+: \{/.test(call));
  assert.equal(objectCalls.length, 3); // support-store.ts, checked below
  const support = readFileSync(path.join(root, "src/lib/support-store.ts"), "utf8");
  assert.equal(support.match(/name: blobStoreName\(STORE_NAME\)/g)?.length, 3);
});
