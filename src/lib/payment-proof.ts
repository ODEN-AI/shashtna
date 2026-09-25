/**
 * Validation for payment-proof images (screenshots of a manual transfer).
 *
 * The browser shrinks photos before upload, so real proofs are small; the
 * server limit stays below Netlify's 6 MB request cap.
 */
export const PROOF_MAX_BYTES = 4 * 1024 * 1024;

export const PROOF_ACCEPT = "image/jpeg,image/png,image/webp";

export type ProofType = "image/jpeg" | "image/png" | "image/webp";

/** Detects the image type from the file's first bytes, ignoring its name. */
export function sniffProofType(bytes: Uint8Array): ProofType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export type ProofCheck =
  | { ok: true; contentType: ProofType }
  | { ok: false; error: string };

export function checkProofBytes(bytes: Uint8Array): ProofCheck {
  if (bytes.length === 0) {
    return { ok: false, error: "يرجى رفع صورة إثبات الدفع." };
  }

  if (bytes.length > PROOF_MAX_BYTES) {
    return { ok: false, error: "حجم الصورة كبير. ارفع صورة أصغر من 4 ميگابايت." };
  }

  const contentType = sniffProofType(bytes);

  if (!contentType) {
    return { ok: false, error: "نوع الملف غير مدعوم. ارفع صورة بصيغة JPG أو PNG." };
  }

  return { ok: true, contentType };
}
