import { getStore } from "@netlify/blobs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BLOB_STORES, blobStoreName } from "@/src/lib/blob-stores";
import { db } from "@/src/prisma/db";
import { isUnpaid, orderRef } from "@/src/lib/order-status";
import { checkProofBytes, type ProofType } from "@/src/lib/payment-proof";
import { shouldUseBlobStorage } from "@/src/lib/runtime";
import { logActivity } from "@/src/server/activity";

/**
 * Payment proofs (screenshots of a manual transfer), one per order.
 *
 * They are private: stored outside `public/` (a dedicated Netlify Blobs store
 * in production, `.data/` locally) and only served through
 * /api/orders/[id]/payment-proof to the order's owner or staff. Each upload
 * is recorded in the activity log, which is also how screens know a proof
 * exists. Uploading a proof never changes the order status: staff verify the
 * transfer and mark the order paid themselves.
 */
// Namespaced per deploy (SHASHTNA_BLOB_NAMESPACE); never falls back to the
// shared store, because order ids overlap between databases.
const STORE_NAME = BLOB_STORES.paymentProofs;
const LOCAL_DIR = path.join(process.cwd(), ".data", "payment-proofs");
export const PROOF_UPLOADED = "PAYMENT_PROOF_UPLOADED";

function key(orderId: number) {
  return `order-${orderId}`;
}

type StoredMeta = { contentType: ProofType; uploadedAt: string };

async function writeProof(orderId: number, bytes: Uint8Array, meta: StoredMeta) {
  if (shouldUseBlobStorage()) {
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: meta.contentType });
    await getStore(blobStoreName(STORE_NAME)).set(key(orderId), blob, { metadata: meta });
    return;
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, key(orderId)), bytes);
  await writeFile(path.join(LOCAL_DIR, `${key(orderId)}.json`), JSON.stringify(meta));
}

export async function readPaymentProof(
  orderId: number,
): Promise<{ data: ArrayBuffer; contentType: ProofType } | null> {
  if (shouldUseBlobStorage()) {
    const result = await getStore(blobStoreName(STORE_NAME)).getWithMetadata(key(orderId), { type: "arrayBuffer" });

    if (!result?.data) {
      return null;
    }

    const contentType = checkProofBytes(new Uint8Array(result.data));
    return contentType.ok ? { data: result.data, contentType: contentType.contentType } : null;
  }

  try {
    const file = await readFile(path.join(LOCAL_DIR, key(orderId)));
    const data = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    const check = checkProofBytes(new Uint8Array(data));
    return check.ok ? { data, contentType: check.contentType } : null;
  } catch {
    return null;
  }
}

export type SaveProofResult = { ok: true } | { ok: false; error: string };

/** Stores the customer's proof for one of their unpaid orders. */
export async function savePaymentProof(
  userId: number,
  orderId: number,
  file: unknown,
): Promise<SaveProofResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "يرجى رفع صورة إثبات الدفع." };
  }

  const order = await db.orm.public.SubscriptionRequest.first({ id: orderId, userId });

  if (!order) {
    return { ok: false, error: "الطلب غير موجود." };
  }

  if (!isUnpaid(order.status)) {
    return { ok: false, error: "تم تأكيد دفع هذا الطلب مسبقًا، ما تحتاج ترفع إثبات جديد." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkProofBytes(bytes);

  if (!check.ok) {
    return check;
  }

  try {
    await writeProof(orderId, bytes, { contentType: check.contentType, uploadedAt: new Date().toISOString() });
  } catch (error) {
    console.error("PAYMENT_PROOF_WRITE_ERROR:", { orderId, message: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: "تعذر رفع الصورة، حاول مرة أخرى." };
  }

  await logActivity({
    actor: { id: userId, role: "CUSTOMER" },
    userId,
    entityType: "ORDER",
    entityId: orderId,
    action: PROOF_UPLOADED,
    summary: `تم رفع إثبات الدفع للطلب ${orderRef(orderId)} — بانتظار مراجعة الفريق`,
    details: JSON.stringify({ contentType: check.contentType, bytes: bytes.length }),
    customerVisible: true,
  });

  return { ok: true };
}

/** When the latest proof for each order was uploaded (orders without one are absent). */
export async function proofUploadTimes(orderIds: number[]) {
  const times = new Map<number, string>();

  if (!orderIds.length) {
    return times;
  }

  const events = await db.orm.public.ActivityEvent.where({ entityType: "ORDER", action: PROOF_UPLOADED })
    .where((event) => event.entityId.in(orderIds.map(String)))
    .orderBy((event) => event.id.asc())
    .all();

  for (const event of events) {
    times.set(Number(event.entityId), String(event.createdAt));
  }

  return times;
}
