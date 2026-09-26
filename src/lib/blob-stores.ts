/**
 * Netlify Blobs store names.
 *
 * Every deploy of the site (production and branch deploys) shares the same
 * Blobs stores. SHASHTNA_BLOB_NAMESPACE isolates a non-production deploy:
 *
 *   unset / empty   → the original store names (production, unchanged)
 *   "mobile-test"   → "mobile-test--shashtna-payment-proofs", …
 *
 * Production never sets the variable. Set it only in a branch/deploy-preview
 * context that has its own database.
 */

export const BLOB_STORES = {
  /** Customer payment proofs, keyed order-<id> (private). */
  paymentProofs: "shashtna-payment-proofs",
  /** Support tickets, keyed tickets/<id>.json. */
  support: "shashtna-support",
  /** Admin media library (announcement/app images), random keys. */
  media: "shashtna-media",
  /** Admin package images, random keys. */
  packageImages: "shashtna-package-images",
} as const;

export type BlobStoreName = (typeof BLOB_STORES)[keyof typeof BLOB_STORES];

const SEPARATOR = "--";
const NAMESPACE = /^[a-z0-9][a-z0-9-]{0,31}$/;

type Env = Record<string, string | undefined>;

/**
 * The configured namespace, or null when unset. An invalid value throws
 * rather than silently falling back to the shared production stores.
 */
export function blobNamespace(env: Env = process.env): string | null {
  const value = String(env.SHASHTNA_BLOB_NAMESPACE ?? "").trim();

  if (!value) {
    return null;
  }

  if (!NAMESPACE.test(value) || value.includes(SEPARATOR)) {
    throw new Error(
      `SHASHTNA_BLOB_NAMESPACE must be 1-32 lowercase letters, digits or single hyphens (got "${value}").`,
    );
  }

  return value;
}

/** The store name to read from and write to for this deploy. */
export function blobStoreName(store: BlobStoreName, env: Env = process.env): string {
  const namespace = blobNamespace(env);

  if (!namespace) {
    return store;
  }

  const prefix = `${namespace}${SEPARATOR}`;

  return store.startsWith(prefix) ? store : `${prefix}${store}`;
}

/**
 * Stores a public image read route may look in, in order: this deploy's
 * store first, then (only when namespaced) the shared original store,
 * read-only. Used only for media and package images, whose keys are random,
 * so a namespaced deploy (with a copy of the production database) can still
 * show images uploaded in production without ever writing to them. Never
 * used for payment proofs or support tickets.
 */
export function imageReadStoreNames(
  store: typeof BLOB_STORES.media | typeof BLOB_STORES.packageImages,
  env: Env = process.env,
): string[] {
  const own = blobStoreName(store, env);

  return own === store ? [store] : [own, store];
}
