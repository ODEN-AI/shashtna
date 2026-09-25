/**
 * Whether persistent files (uploads, support tickets) go to Netlify Blobs or
 * to the local filesystem.
 *
 * - On Netlify the function filesystem is read-only, so Blobs is required.
 * - A local `next start` is a production build but has no Blobs context,
 *   so it uses local files.
 * `SHASHTNA_STORAGE=netlify|local` overrides the detection.
 */
export function shouldUseBlobStorage() {
  const override = String(process.env.SHASHTNA_STORAGE ?? "").trim().toLowerCase();

  if (override === "netlify") {
    return true;
  }

  if (override === "local") {
    return false;
  }

  return (
    String(process.env.NETLIFY ?? "").toLowerCase() === "true" ||
    Boolean(process.env.NETLIFY_BLOBS_CONTEXT) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.SITE_ID && process.env.DEPLOY_ID)
  );
}
