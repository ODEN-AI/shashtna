/**
 * Branch-safe Blobs namespacing, exercised end to end against a real local
 * Netlify Blobs server (@netlify/blobs/server) and the test database:
 * payment proofs, support tickets and admin media are written to and read
 * from "<namespace>--<store>", production (no namespace) never sees them, and
 * payment proofs / tickets never fall back to the shared stores.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";

import { BlobsServer } from "@netlify/blobs/server";

process.env.AUTH_SECRET ??= "integration-test-secret-integration-test-secret";

const TOKEN = "blobs-test-token";
const directory = mkdtempSync(path.join(tmpdir(), "shashtna-blobs-"));
const server = new BlobsServer({ directory, token: TOKEN });

const { getStore } = await import("@netlify/blobs");
const { db } = await import("@/src/prisma/db");
const { issueSession } = await import("@/src/server/sessions");
const { readPaymentProof, savePaymentProof } = await import("@/src/server/payment-proofs");
const { getAllSupportTickets, getSupportTicket, saveSupportTicket, makeSupportTicketId } = await import("@/src/lib/support-store");
const mediaUpload = await import("@/app/api/admin/media/upload/route");
const packageUpload = await import("@/app/api/admin/packages/upload/route");
const mediaRead = await import("@/app/api/uploads/media/[key]/route");
const packageRead = await import("@/app/api/uploads/packages/[key]/route");

const RUN = Date.now().toString(36);
const DIGITS = String(Date.now()).slice(-8);
const PNG = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
);

const saved = { storage: process.env.SHASHTNA_STORAGE, namespace: process.env.SHASHTNA_BLOB_NAMESPACE };

function useNamespace(value: string | undefined) {
  if (value === undefined) delete process.env.SHASHTNA_BLOB_NAMESPACE;
  else process.env.SHASHTNA_BLOB_NAMESPACE = value;
}

async function keys(store: string) {
  const { blobs } = await getStore({ name: store, consistency: "strong" }).list();
  return blobs.map((blob) => blob.key).sort();
}

let adminToken = "";
let customer: { id: number; name: string; phone: string };

before(async () => {
  const { port } = await server.start();
  const url = `http://localhost:${port}`;
  (globalThis as { netlifyBlobsContext?: string }).netlifyBlobsContext = Buffer.from(
    JSON.stringify({ siteID: "shashtna-test-site", token: TOKEN, edgeURL: url, uncachedEdgeURL: url }),
  ).toString("base64");
  process.env.SHASHTNA_STORAGE = "netlify";

  const owner = await db.orm.public.User.create({ name: "Blob Admin", phone: `0790${DIGITS}`, passwordHash: "x", role: "OWNER" });
  adminToken = issueSession(owner).token;
  const row = await db.orm.public.User.create({ name: "Blob Customer", phone: `0791${DIGITS}`, passwordHash: "x", role: "CUSTOMER" });
  customer = { id: row.id, name: row.name, phone: row.phone };
});

after(async () => {
  useNamespace(saved.namespace);
  if (saved.storage === undefined) delete process.env.SHASHTNA_STORAGE;
  else process.env.SHASHTNA_STORAGE = saved.storage;
  delete (globalThis as { netlifyBlobsContext?: string }).netlifyBlobsContext;
  await server.stop();
  rmSync(directory, { recursive: true, force: true });
});

describe("payment proofs", () => {
  test("a namespaced deploy writes and reads only its own store, and never falls back", async () => {
    const order = await db.orm.public.SubscriptionRequest.create({
      userId: customer.id,
      planSlug: `blob-${RUN}`,
      serviceName: "Blob plan",
      price: 1000,
      status: "SUBMITTED",
    });

    // Production already holds a proof under the same key (order ids overlap
    // between databases).
    useNamespace(undefined);
    await getStore("shashtna-payment-proofs").set(`order-${order.id}`, new Blob([PNG]), { metadata: { contentType: "image/png" } });

    useNamespace("mobile-test");
    assert.equal(await readPaymentProof(order.id), null, "must not fall back to the production proof");

    const result = await savePaymentProof(customer.id, order.id, new File([PNG], "p.png", { type: "image/png" }));
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(await keys("mobile-test--shashtna-payment-proofs"), [`order-${order.id}`]);
    assert.ok(await readPaymentProof(order.id));

    // The production proof was not overwritten or duplicated.
    assert.deepEqual(await keys("shashtna-payment-proofs"), [`order-${order.id}`]);
  });
});

describe("support tickets", () => {
  function ticket(subject: string) {
    const now = new Date().toISOString();
    return {
      id: makeSupportTicketId(),
      userId: customer.id,
      userName: customer.name,
      userPhone: customer.phone,
      subject,
      category: "general",
      status: "OPEN" as const,
      createdAt: now,
      updatedAt: now,
      lastSender: "CUSTOMER" as const,
      messages: [],
    };
  }

  test("production and the namespaced deploy never see each other's tickets", async () => {
    useNamespace(undefined);
    const production = ticket(`prod ${RUN}`);
    await saveSupportTicket(production);

    useNamespace("mobile-test");
    const branch = ticket(`branch ${RUN}`);
    await saveSupportTicket(branch);

    const branchList = (await getAllSupportTickets()).map((item) => item.id);
    assert.deepEqual(branchList, [branch.id]);
    assert.equal(await getSupportTicket(production.id), null);
    assert.deepEqual(await keys("mobile-test--shashtna-support"), [`tickets/${branch.id}.json`]);

    useNamespace(undefined);
    const productionList = (await getAllSupportTickets()).map((item) => item.id);
    assert.deepEqual(productionList, [production.id]);
    assert.equal(await getSupportTicket(branch.id), null);
  });
});

describe("admin media and package images", () => {
  async function upload(route: { POST: (request: Request) => Promise<Response> }, pathname: string) {
    const form = new FormData();
    form.append("file", new File([PNG], "image.png", { type: "image/png" }));
    const response = await route.POST(
      new Request(`http://localhost${pathname}`, { method: "POST", headers: { Authorization: `Bearer ${adminToken}` }, body: form }),
    );
    assert.ok(response.status === 200 || response.status === 201, `upload ${pathname} → ${response.status}`);
    return (await response.json()) as { imageUrl: string };
  }

  async function read(route: { GET: (request: Request, context: { params: Promise<{ key: string }> }) => Promise<Response> }, key: string) {
    return (await route.GET(new Request("http://localhost/"), { params: Promise.resolve({ key }) })).status;
  }

  test("uploads from a namespaced deploy land only in the namespaced store", async () => {
    useNamespace("mobile-test");
    const media = await upload(mediaUpload, "/api/admin/media/upload");
    const mediaKey = decodeURIComponent(media.imageUrl.replace("/api/uploads/media/", ""));
    const pkg = await upload(packageUpload, "/api/admin/packages/upload");
    const packageKey = pkg.imageUrl.replace("/api/uploads/packages/", "");

    assert.deepEqual(await keys("mobile-test--shashtna-media"), [mediaKey]);
    assert.deepEqual(await keys("mobile-test--shashtna-package-images"), [packageKey]);
    assert.deepEqual(await keys("shashtna-media"), []);
    assert.deepEqual(await keys("shashtna-package-images"), []);

    // Readable on the namespaced deploy, invisible to production.
    assert.equal(await read(mediaRead, encodeURIComponent(mediaKey)), 200);
    assert.equal(await read(packageRead, packageKey), 200);
    useNamespace(undefined);
    assert.equal(await read(mediaRead, encodeURIComponent(mediaKey)), 404);
    assert.equal(await read(packageRead, packageKey), 404);
  });

  test("production uploads keep the original store names; a namespaced deploy can still display them read-only", async () => {
    useNamespace(undefined);
    const media = await upload(mediaUpload, "/api/admin/media/upload");
    const mediaKey = decodeURIComponent(media.imageUrl.replace("/api/uploads/media/", ""));
    const pkg = await upload(packageUpload, "/api/admin/packages/upload");
    const packageKey = pkg.imageUrl.replace("/api/uploads/packages/", "");
    assert.ok((await keys("shashtna-media")).includes(mediaKey));
    assert.ok((await keys("shashtna-package-images")).includes(packageKey));

    useNamespace("mobile-test");
    assert.equal(await read(mediaRead, encodeURIComponent(mediaKey)), 200);
    assert.equal(await read(packageRead, packageKey), 200);
    // Reading did not copy anything into the namespaced stores.
    assert.ok(!(await keys("mobile-test--shashtna-media")).includes(mediaKey));
    assert.ok(!(await keys("mobile-test--shashtna-package-images")).includes(packageKey));
  });
});
