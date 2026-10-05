/**
 * Shashtna APK distribution: storage layout, HTTP header policy, release
 * metadata and a minimal S3-compatible client for Cloudflare R2.
 *
 * Node built-ins only (crypto + fetch). Credentials come from the caller's
 * environment and are never logged or written to an object.
 *
 * Bucket layout (public through the custom domain download.shashtna.net):
 *
 *   Shashtna.apk                              latest stable APK (permanent URL)
 *   Shashtna.apk.sha256                       checksum of the latest APK
 *   latest.json                               latest release metadata
 *   releases/index.json                       every published release
 *   releases/v1.0.1/Shashtna.apk              immutable versioned APK
 *   releases/v1.0.1/Shashtna.apk.sha256
 *   releases/v1.0.1/release.json
 */

import { createHash, createHmac } from "node:crypto";

export const APK_NAME = "Shashtna.apk";
export const APK_CONTENT_TYPE = "application/vnd.android.package-archive";
export const DEFAULT_PUBLIC_BASE_URL = "https://download.shashtna.net";
/** R2 single-request upload limit is 5 GiB; APKs are far below it. */
export const MAX_APK_BYTES = 4 * 1024 ** 3;

// ------------------------------------------------------------------ layout

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z][0-9A-Za-z.-]{0,30})?$/;

/** "1.0.1" or "v1.0.1" → "1.0.1"; anything else (paths, spaces, ..) → null. */
export function normalizeVersion(input) {
  const text = String(input ?? "").trim().replace(/^v/i, "");
  return VERSION.test(text) ? text : null;
}

export function normalizeBuild(input) {
  const text = String(input ?? "").trim();
  return /^\d{1,9}$/.test(text) && Number(text) > 0 ? Number(text) : null;
}

export const keys = {
  latestApk: APK_NAME,
  latestChecksum: `${APK_NAME}.sha256`,
  latestJson: "latest.json",
  index: "releases/index.json",
  releaseDir: (version) => `releases/v${version}`,
  releaseApk: (version) => `releases/v${version}/${APK_NAME}`,
  releaseChecksum: (version) => `releases/v${version}/${APK_NAME}.sha256`,
  releaseJson: (version) => `releases/v${version}/release.json`,
};

// ----------------------------------------------------------- header policy

/**
 * Versioned files never change → cached for a year everywhere. The
 * permanent URL changes on every release → browsers and the CDN may keep it
 * 5 minutes and must revalidate (ETag) after that; the release tool also
 * purges the CDN copy when a zone token is configured.
 */
export const CACHE = {
  immutable: "public, max-age=31536000, immutable",
  latestApk: "public, max-age=300, must-revalidate",
  metadata: "public, max-age=60, must-revalidate",
};

export function apkHeaders(kind, version) {
  const filename = kind === "latest" ? APK_NAME : `Shashtna-${version}.apk`;
  return {
    "content-type": APK_CONTENT_TYPE,
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": kind === "latest" ? CACHE.latestApk : CACHE.immutable,
  };
}

export function textHeaders(kind, contentType = "application/json; charset=utf-8") {
  return { "content-type": contentType, "cache-control": kind === "latest" ? CACHE.metadata : CACHE.immutable };
}

// ---------------------------------------------------------------- content

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

/** `sha256sum -c` compatible line. */
export function checksumLine(hex, filename = APK_NAME) {
  return `${hex}  ${filename}\n`;
}

/**
 * Cheap sanity check before anything is uploaded: an APK is a ZIP whose
 * central directory names AndroidManifest.xml. Catches wrong files (AAB,
 * HTML error page saved as .apk, truncated downloads).
 */
export function checkApkBytes(bytes) {
  if (!bytes || bytes.length < 22) return { ok: false, error: "File is empty or too small to be an APK." };
  if (bytes.length > MAX_APK_BYTES) return { ok: false, error: "File is larger than 4 GiB." };
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    return { ok: false, error: "Not an APK (no ZIP signature). Was an HTML page or AAB saved instead?" };
  }
  const tail = Buffer.from(bytes.subarray(Math.max(0, bytes.length - 4 * 1024 * 1024)));
  if (tail.indexOf("AndroidManifest.xml") === -1) return { ok: false, error: "ZIP has no AndroidManifest.xml (not an APK)." };
  if (tail.indexOf("BundleConfig.pb") !== -1) return { ok: false, error: "This is an Android App Bundle (.aab), not an APK." };
  return { ok: true };
}

export function releaseMetadata({ version, build, sha256, size, releaseDate, notes, baseUrl = DEFAULT_PUBLIC_BASE_URL }) {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    name: "Shashtna",
    version,
    build,
    releaseDate,
    size,
    sha256,
    notes: notes || null,
    downloadUrl: `${base}/${APK_NAME}`,
    versionUrl: `${base}/${keys.releaseApk(version)}`,
    checksumUrl: `${base}/${keys.releaseChecksum(version)}`,
  };
}

/** Insert/replace one release in the index, newest build first. */
export function updateIndex(index, release, latestVersion) {
  const releases = (Array.isArray(index?.releases) ? index.releases : []).filter((item) => item.version !== release.version);
  releases.push(release);
  releases.sort((a, b) => b.build - a.build || String(b.version).localeCompare(String(a.version)));
  return { latest: latestVersion ?? index?.latest ?? null, releases };
}

// ----------------------------------------------------- SigV4 (S3 / R2 API)

const hmac = (key, data) => createHmac("sha256", key).update(data, "utf8").digest();
export const EMPTY_SHA256 = sha256Hex("");

/** RFC 3986 encoding as S3 expects (each path segment, slashes kept). */
export function encodeKey(path) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

export function amzDate(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * AWS Signature Version 4. `headers` must already contain host, x-amz-date
 * and x-amz-content-sha256 (or the caller's equivalent). Returns the
 * Authorization header value. Pure: verified against AWS's published
 * example vectors in tests/apk-release.test.ts.
 */
export function signV4({ method, path, query = "", headers, payloadHash, accessKeyId, secretAccessKey, region, service }) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, " ")]));
  const signedHeaders = Object.keys(lower).sort();
  const canonicalHeaders = signedHeaders.map((name) => `${name}:${lower[name]}\n`).join("");
  const canonicalQuery = query
    ? query
        .split("&")
        .map((pair) => pair.split("="))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v = ""]) => `${k}=${v}`)
        .join("&")
    : "";
  const canonicalRequest = [method, path, canonicalQuery, canonicalHeaders, signedHeaders.join(";"), payloadHash].join("\n");
  const date = lower["x-amz-date"];
  const scope = `${date.slice(0, 8)}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", date, scope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${secretAccessKey}`, date.slice(0, 8));
  const kSigning = hmac(hmac(hmac(kDate, region), service), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;
}

export class StorageError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * R2 config from the environment; throws a clear message (without values) when incomplete.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function r2ConfigFromEnv(env = process.env) {
  const missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].filter((name) => !String(env[name] ?? "").trim());
  if (missing.length) throw new StorageError(`Missing environment variables: ${missing.join(", ")}`, 0, "CONFIG");

  return {
    endpoint: (env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`).replace(/\/+$/, ""),
    bucket: env.R2_BUCKET,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    region: "auto",
  };
}

/** Minimal R2 client: put, conditional put, server-side copy, get, head. */
export function createR2Client(config, fetchImpl = globalThis.fetch) {
  async function send(method, key, { body, headers = {}, payloadHash } = {}) {
    const url = new URL(`${config.endpoint}/${encodeKey(config.bucket)}/${encodeKey(key)}`);
    const hash = payloadHash ?? (body ? sha256Hex(body) : EMPTY_SHA256);
    const signed = { host: url.host, "x-amz-date": amzDate(), "x-amz-content-sha256": hash, ...headers };
    const authorization = signV4({
      method,
      path: url.pathname,
      headers: signed,
      payloadHash: hash,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      service: "s3",
    });
    // fetch sets Host itself; it is only part of the signature.
    const sendHeaders = Object.fromEntries(Object.entries(signed).filter(([name]) => name !== "host"));

    let response;
    try {
      // Never hang: 15 minutes for an upload with a body (slow uplinks), 30 s otherwise.
      const signal = AbortSignal.timeout(body ? 15 * 60_000 : 30_000);
      response = await fetchImpl(url, { method, headers: { ...sendHeaders, authorization }, body, signal });
    } catch {
      throw new StorageError(`Storage unreachable or timed out (${method} ${key}).`, 0, "UNREACHABLE");
    }
    return response;
  }

  async function expectOk(response, what) {
    if (response.ok) return response;
    const text = await response.text().catch(() => "");
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] ?? `HTTP_${response.status}`;
    throw new StorageError(`${what} failed (${response.status} ${code}).`, response.status, code);
  }

  return {
    /** Upload an object with its public headers. `ifNoneMatch` refuses to overwrite an existing key. */
    async put(key, body, headers, { ifNoneMatch = false, metadata = {} } = {}) {
      const meta = Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`x-amz-meta-${k}`, String(v)]));
      const extra = ifNoneMatch ? { "if-none-match": "*" } : {};
      const response = await send("PUT", key, { body, headers: { ...headers, ...meta, ...extra } });
      if (ifNoneMatch && response.status === 412) throw new StorageError(`${key} already exists.`, 412, "EXISTS");
      return expectOk(response, `Upload of ${key}`);
    },

    /** Server-side copy (no re-upload) with replaced public headers. */
    async copy(fromKey, toKey, headers, metadata = {}) {
      const meta = Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`x-amz-meta-${k}`, String(v)]));
      const response = await send("PUT", toKey, {
        headers: {
          ...headers,
          ...meta,
          "x-amz-copy-source": `/${encodeKey(config.bucket)}/${encodeKey(fromKey)}`,
          "x-amz-metadata-directive": "REPLACE",
        },
      });
      await expectOk(response, `Copy ${fromKey} → ${toKey}`);
      const text = await response.text().catch(() => "");
      if (/<Error>/.test(text)) throw new StorageError(`Copy ${fromKey} → ${toKey} failed.`, response.status, "COPY_FAILED");
      return response;
    },

    async head(key) {
      const response = await send("HEAD", key);
      if (response.status === 404) return null;
      await expectOk(response, `HEAD ${key}`);
      return response.headers;
    },

    async getJson(key) {
      const response = await send("GET", key);
      if (response.status === 404) return null;
      await expectOk(response, `GET ${key}`);
      return response.json();
    },
  };
}

// ----------------------------------------------------------- CDN purge

/**
 * Purge the permanent URLs from Cloudflare's cache (optional; needs a Zone → Cache Purge token).
 *
 * @param {string[]} urls
 * @param {Record<string, string | undefined>} [env]
 */
export async function purgeCdn(urls, env = process.env, fetchImpl = globalThis.fetch) {
  const zone = String(env.CLOUDFLARE_ZONE_ID ?? "").trim();
  const token = String(env.CLOUDFLARE_API_TOKEN ?? "").trim();
  if (!zone || !token) return { purged: false, reason: "CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN not set (latest URL refreshes within 5 minutes)." };

  try {
    const response = await fetchImpl(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}/purge_cache`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ files: urls }),
    });
    const data = await response.json().catch(() => ({}));
    return data?.success ? { purged: true } : { purged: false, reason: `Cloudflare purge refused (HTTP ${response.status}).` };
  } catch {
    return { purged: false, reason: "Cloudflare API unreachable." };
  }
}
