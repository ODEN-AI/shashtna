#!/usr/bin/env node
/**
 * Shashtna APK release tool (Cloudflare R2 behind download.shashtna.net).
 *
 *   node scripts/apk/release.mjs publish --file Shashtna.apk --version 1.0.1 --build 3 [--notes "…"] [--no-latest] [--force]
 *   node scripts/apk/release.mjs promote --version 1.0.0      # make an existing release the latest (rollback)
 *   node scripts/apk/release.mjs list
 *   node scripts/apk/release.mjs verify [--base-url https://download.shashtna.net]
 *
 * Environment: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 * (optional: APK_PUBLIC_BASE_URL, CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN for
 * cache purge, R2_ENDPOINT for testing). See docs/apk-distribution.md.
 */

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  APK_CONTENT_TYPE,
  APK_NAME,
  DEFAULT_PUBLIC_BASE_URL,
  StorageError,
  apkHeaders,
  checkApkBytes,
  checksumLine,
  createR2Client,
  keys,
  normalizeBuild,
  normalizeVersion,
  purgeCdn,
  r2ConfigFromEnv,
  releaseMetadata,
  sha256Hex,
  textHeaders,
  updateIndex,
} from "./lib.mjs";

/**
 * Upload one release. Order matters: the immutable versioned files first
 * (refusing to overwrite an existing version unless `force`), then — only if
 * all of that succeeded — promotion to the permanent URL. A failed upload
 * never changes what Shashtna.apk serves.
 *
 * @param {ReturnType<typeof createR2Client>} client
 * @param {{ bytes: Uint8Array, version: string, build: number, notes?: string | null, makeLatest?: boolean, force?: boolean, baseUrl?: string, now?: Date }} options
 */
export async function publishRelease(client, { bytes, version, build, notes, makeLatest = true, force = false, baseUrl, now = new Date() }) {
  const check = checkApkBytes(bytes);
  if (!check.ok) throw new StorageError(check.error, 0, "INVALID_APK");

  const sha256 = sha256Hex(bytes);
  const release = releaseMetadata({ version, build, sha256, size: bytes.length, releaseDate: now.toISOString(), notes, baseUrl });

  await client.put(keys.releaseApk(version), bytes, apkHeaders("version", version), {
    ifNoneMatch: !force,
    metadata: { sha256, version, build },
  });
  await client.put(keys.releaseChecksum(version), Buffer.from(checksumLine(sha256, `Shashtna-${version}.apk`)), textHeaders("version", "text/plain; charset=utf-8"));
  await client.put(keys.releaseJson(version), Buffer.from(`${JSON.stringify(release, null, 2)}\n`), textHeaders("version"));

  const index = updateIndex(await client.getJson(keys.index), release, makeLatest ? version : undefined);
  await client.put(keys.index, Buffer.from(`${JSON.stringify(index, null, 2)}\n`), textHeaders("latest"));

  if (makeLatest) await promoteRelease(client, { version, baseUrl, release });

  return release;
}

/**
 * Point the permanent URL (and latest.json) at an existing release, by server-side copy.
 *
 * @param {ReturnType<typeof createR2Client>} client
 * @param {{ version: string, baseUrl?: string, release?: ReturnType<typeof releaseMetadata> }} options
 */
export async function promoteRelease(client, { version, baseUrl, release }) {
  const meta = release ?? (await client.getJson(keys.releaseJson(version)));
  if (!meta) throw new StorageError(`Release v${version} does not exist.`, 404, "NO_RELEASE");
  if (!(await client.head(keys.releaseApk(version)))) throw new StorageError(`APK for v${version} is missing.`, 404, "NO_APK");

  // The APK first, then its checksum and metadata: a client reading latest.json
  // never sees a version whose APK is not yet behind the permanent URL.
  await client.copy(keys.releaseApk(version), keys.latestApk, apkHeaders("latest"), { sha256: meta.sha256, version: meta.version, build: meta.build });
  await client.put(keys.latestChecksum, Buffer.from(checksumLine(meta.sha256)), textHeaders("latest", "text/plain; charset=utf-8"));
  await client.put(keys.latestJson, Buffer.from(`${JSON.stringify(meta, null, 2)}\n`), textHeaders("latest"));

  const index = await client.getJson(keys.index);
  if (index && index.latest !== version) {
    await client.put(keys.index, Buffer.from(`${JSON.stringify({ ...index, latest: version }, null, 2)}\n`), textHeaders("latest"));
  }

  const base = (baseUrl ?? DEFAULT_PUBLIC_BASE_URL).replace(/\/+$/, "");
  return { version, urls: [`${base}/${APK_NAME}`, `${base}/${keys.latestChecksum}`, `${base}/${keys.latestJson}`] };
}

/**
 * Checks the public URL exactly as a TV / Downloader sees it: direct 200 (no
 * redirect), APK content type, attachment filename, byte ranges, and the
 * downloaded bytes match latest.json's SHA-256.
 */
export async function verifyPublic(baseUrl, fetchImpl = globalThis.fetch) {
  const base = baseUrl.replace(/\/+$/, "");
  const problems = [];
  const latest = await fetchImpl(`${base}/${keys.latestJson}`, { redirect: "manual" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!latest) return { ok: false, problems: [`${base}/latest.json is not reachable.`] };

  const head = await fetchImpl(`${base}/${APK_NAME}`, { method: "HEAD", redirect: "manual" });
  if (head.status !== 200) problems.push(`HEAD ${APK_NAME} → ${head.status} (expected 200, no redirect).`);
  if (head.headers.get("content-type") !== APK_CONTENT_TYPE) problems.push(`Content-Type is "${head.headers.get("content-type")}".`);
  if (!/attachment;\s*filename="?Shashtna\.apk"?/i.test(head.headers.get("content-disposition") ?? "")) problems.push("Content-Disposition does not name Shashtna.apk.");
  if (!/max-age=\d+/.test(head.headers.get("cache-control") ?? "")) problems.push("Cache-Control is missing.");

  const range = await fetchImpl(`${base}/${APK_NAME}`, { headers: { range: "bytes=0-3" }, redirect: "manual" });
  const firstBytes = Buffer.from(await range.arrayBuffer());
  if (range.status !== 206) problems.push(`Range request → ${range.status} (expected 206; resumable downloads need it).`);
  if (firstBytes.subarray(0, 2).toString("latin1") !== "PK") problems.push("The first bytes are not an APK/ZIP.");

  const full = await fetchImpl(`${base}/${APK_NAME}`, { redirect: "manual" });
  const sha256 = sha256Hex(Buffer.from(await full.arrayBuffer()));
  if (sha256 !== latest.sha256) problems.push(`Downloaded SHA-256 ${sha256} ≠ latest.json ${latest.sha256} (CDN still serving the previous release?).`);

  return { ok: problems.length === 0, problems, latest: { version: latest.version, build: latest.build, sha256: latest.sha256 } };
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith("--")) continue;
    const [name, inline] = arg.slice(2).split("=", 2);
    if (inline !== undefined) flags[name] = inline;
    else if (rest[i + 1] && !rest[i + 1].startsWith("--")) flags[name] = rest[++i];
    else flags[name] = true;
  }
  return { command, flags };
}

const USAGE = `Usage:
  publish --file <path.apk> --version <x.y.z> --build <n> [--notes "…"] [--no-latest] [--force]
  promote --version <x.y.z>
  list
  verify [--base-url ${DEFAULT_PUBLIC_BASE_URL}]`;

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const baseUrl = String(flags["base-url"] ?? process.env.APK_PUBLIC_BASE_URL ?? DEFAULT_PUBLIC_BASE_URL);

  if (command === "verify") {
    const result = await verifyPublic(baseUrl);
    if (result.latest) console.log(`latest: v${result.latest.version} (build ${result.latest.build}) sha256 ${result.latest.sha256}`);
    for (const problem of result.problems) console.error(`✗ ${problem}`);
    console.log(result.ok ? `✓ ${baseUrl}/${APK_NAME} is a direct, resumable APK download.` : "✗ verification failed");
    return result.ok ? 0 : 1;
  }

  if (!["publish", "promote", "list"].includes(command)) {
    console.error(USAGE);
    return 2;
  }

  const client = createR2Client(r2ConfigFromEnv());

  if (command === "publish") {
    const version = normalizeVersion(flags.version);
    const build = normalizeBuild(flags.build);
    if (!flags.file || !version || !build) throw new StorageError(`publish needs --file, --version (x.y.z) and --build (positive integer).\n${USAGE}`, 0, "USAGE");
    const bytes = await readFile(String(flags.file));
    const makeLatest = !flags["no-latest"];
    const release = await publishRelease(client, { bytes, version, build, notes: flags.notes ? String(flags.notes) : null, makeLatest, force: Boolean(flags.force), baseUrl });
    console.log(`✓ uploaded v${release.version} (build ${release.build}, ${(release.size / 1024 / 1024).toFixed(1)} MB)`);
    console.log(`  sha256 ${release.sha256}`);
    console.log(`  ${release.versionUrl}`);
    if (makeLatest) {
      console.log(`✓ ${release.downloadUrl} now serves v${release.version}`);
      const purge = await purgeCdn([release.downloadUrl, `${baseUrl}/${keys.latestChecksum}`, `${baseUrl}/${keys.latestJson}`]);
      console.log(purge.purged ? "✓ CDN cache purged" : `• ${purge.reason}`);
    } else {
      console.log(`• not promoted; run: promote --version ${release.version}`);
    }
    return 0;
  }

  if (command === "promote") {
    const version = normalizeVersion(flags.version);
    if (!version) throw new StorageError(`promote needs --version (x.y.z).\n${USAGE}`, 0, "USAGE");
    const result = await promoteRelease(client, { version, baseUrl });
    console.log(`✓ ${result.urls[0]} now serves v${version}`);
    const purge = await purgeCdn(result.urls);
    console.log(purge.purged ? "✓ CDN cache purged" : `• ${purge.reason}`);
    return 0;
  }

  if (command === "list") {
    const index = await client.getJson(keys.index);
    if (!index?.releases?.length) {
      console.log("No releases yet.");
      return 0;
    }
    for (const item of index.releases) {
      console.log(`${item.version === index.latest ? "*" : " "} v${item.version}  build ${item.build}  ${item.releaseDate.slice(0, 10)}  ${item.sha256.slice(0, 16)}…`);
    }
    return 0;
  }

  console.error(USAGE);
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      // Messages only: never request headers, credentials or stack traces.
      console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(error instanceof StorageError && error.code === "EXISTS" ? 3 : 1);
    });
}
