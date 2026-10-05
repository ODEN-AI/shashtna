import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test } from "node:test";

const lib = await import("../scripts/apk/lib.mjs");
const { publishRelease, promoteRelease, verifyPublic } = await import("../scripts/apk/release.mjs");

// ------------------------------------------------------------------ pure rules

test("SigV4 matches AWS's published example signatures", () => {
  const iam = lib.signV4({
    method: "GET",
    path: "/",
    query: "Action=ListUsers&Version=2010-05-08",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8", host: "iam.amazonaws.com", "x-amz-date": "20150830T123600Z" },
    payloadHash: lib.EMPTY_SHA256,
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    service: "iam",
  });
  assert.ok(iam.endsWith("Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7"));

  const s3 = lib.signV4({
    method: "GET",
    path: "/test.txt",
    headers: { host: "examplebucket.s3.amazonaws.com", range: "bytes=0-9", "x-amz-content-sha256": lib.EMPTY_SHA256, "x-amz-date": "20130524T000000Z" },
    payloadHash: lib.EMPTY_SHA256,
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    service: "s3",
  });
  assert.ok(s3.endsWith("Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"));
});

test("versions and builds: strict, no path tricks", () => {
  assert.equal(lib.normalizeVersion("1.0.1"), "1.0.1");
  assert.equal(lib.normalizeVersion("v2.10.0"), "2.10.0");
  assert.equal(lib.normalizeVersion("1.2.0-beta.1"), "1.2.0-beta.1");
  for (const bad of ["", "1.0", "1.0.0/../x", "../1.0.0", "1.0.0 ", "1.0.0;rm", "latest", null]) {
    assert.equal(lib.normalizeVersion(bad === "1.0.0 " ? "1.0.0 x" : bad), null, String(bad));
  }
  assert.equal(lib.normalizeBuild("7"), 7);
  for (const bad of ["0", "-1", "1.5", "x", ""]) assert.equal(lib.normalizeBuild(bad), null, bad);
});

test("layout: one permanent URL, immutable versioned copies", () => {
  assert.equal(lib.keys.latestApk, "Shashtna.apk");
  assert.equal(lib.keys.releaseApk("1.0.1"), "releases/v1.0.1/Shashtna.apk");
  assert.deepEqual(lib.apkHeaders("latest"), {
    "content-type": "application/vnd.android.package-archive",
    "content-disposition": 'attachment; filename="Shashtna.apk"',
    "cache-control": "public, max-age=300, must-revalidate",
  });
  assert.equal(lib.apkHeaders("version", "1.0.1")["cache-control"], "public, max-age=31536000, immutable");
  assert.equal(lib.apkHeaders("version", "1.0.1")["content-disposition"], 'attachment; filename="Shashtna-1.0.1.apk"');
});

const fakeApk = (marker = "A") =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(2048, marker), Buffer.from("AndroidManifest.xml"), Buffer.alloc(64)]);

test("APK sanity check rejects HTML pages, AABs and empty files", () => {
  assert.deepEqual(lib.checkApkBytes(fakeApk()), { ok: true });
  assert.equal(lib.checkApkBytes(Buffer.from("<!doctype html><title>MediaFire</title>")).ok, false);
  assert.equal(lib.checkApkBytes(Buffer.alloc(0)).ok, false);
  assert.equal(lib.checkApkBytes(Buffer.concat([fakeApk(), Buffer.from("BundleConfig.pb")])).ok, false);
  assert.equal(lib.checkApkBytes(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(100)])).ok, false);
});

test("metadata, checksum line and index", () => {
  const release = lib.releaseMetadata({ version: "1.0.1", build: 3, sha256: "ab", size: 10, releaseDate: "2026-10-05T00:00:00.000Z", notes: null });
  assert.equal(release.downloadUrl, "https://download.shashtna.net/Shashtna.apk");
  assert.equal(release.versionUrl, "https://download.shashtna.net/releases/v1.0.1/Shashtna.apk");
  assert.equal(lib.checksumLine("ab"), "ab  Shashtna.apk\n");
  let index = lib.updateIndex(null, { ...release, build: 3 }, "1.0.1");
  index = lib.updateIndex(index, { ...release, version: "1.0.0", build: 2 }, undefined);
  index = lib.updateIndex(index, { ...release, version: "1.0.1", build: 3, notes: "again" }, undefined);
  assert.deepEqual(index.releases.map((r: { version: string }) => r.version), ["1.0.1", "1.0.0"]);
  assert.equal(index.latest, "1.0.1");
});

test("missing credentials are reported by name, never by value", () => {
  assert.throws(() => lib.r2ConfigFromEnv({ R2_ACCOUNT_ID: "a", R2_BUCKET: "b" }), /R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/);
});

// ------------------------------------------------- fake R2 + public domain

type Stored = { body: Buffer; headers: Record<string, string> };
const SECRET = "test-secret-key";

function readBody(request: IncomingMessage) {
  return new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/** S3 API subset (signed) + public custom-domain reads with Range, both over one object store. */
function startFakes() {
  const objects = new Map<string, Stored>();
  const PUBLIC = ["content-type", "content-disposition", "cache-control"];
  const pick = (headers: Record<string, string>) => Object.fromEntries(PUBLIC.filter((h) => headers[h] !== undefined).map((h) => [h, headers[h]]));

  const api = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const body = await readBody(request);
    const url = new URL(request.url ?? "/", "http://x");
    const key = decodeURIComponent(url.pathname.replace(/^\/bucket\//, ""));
    const headers = request.headers as Record<string, string>;

    // Authenticate exactly like R2 would: recompute the signature from the signed headers.
    const auth = headers.authorization ?? "";
    const signedNames = /SignedHeaders=([^,]+)/.exec(auth)?.[1].split(";") ?? [];
    const signed = Object.fromEntries(signedNames.map((name) => [name, headers[name]]));
    const expected = lib.signV4({
      method: request.method,
      path: url.pathname,
      headers: signed,
      payloadHash: headers["x-amz-content-sha256"],
      accessKeyId: "test-key-id",
      secretAccessKey: SECRET,
      region: "auto",
      service: "s3",
    });
    const hashOk = body.length === 0 || lib.sha256Hex(body) === headers["x-amz-content-sha256"];
    if (auth !== expected || !hashOk || !signedNames.includes("host")) {
      response.writeHead(403).end("<Error><Code>SignatureDoesNotMatch</Code></Error>");
      return;
    }

    if (request.method === "PUT" && headers["x-amz-copy-source"]) {
      const source = objects.get(decodeURIComponent(headers["x-amz-copy-source"].replace(/^\/bucket\//, "")));
      if (!source) return void response.writeHead(404).end("<Error><Code>NoSuchKey</Code></Error>");
      const replaced = headers["x-amz-metadata-directive"] === "REPLACE";
      objects.set(key, { body: source.body, headers: replaced ? pick(headers) : source.headers });
      return void response.writeHead(200).end("<CopyObjectResult/>");
    }
    if (request.method === "PUT") {
      if (headers["if-none-match"] === "*" && objects.has(key)) return void response.writeHead(412).end("<Error><Code>PreconditionFailed</Code></Error>");
      objects.set(key, { body, headers: pick(headers) });
      return void response.writeHead(200).end();
    }
    const object = objects.get(key);
    if (!object) return void response.writeHead(404).end("<Error><Code>NoSuchKey</Code></Error>");
    response.writeHead(200, object.headers);
    response.end(request.method === "HEAD" ? undefined : object.body);
  });

  const site = createServer((request: IncomingMessage, response: ServerResponse) => {
    const key = decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname.slice(1));
    const object = objects.get(key);
    if (!object) return void response.writeHead(404).end("Object not found");
    const range = /^bytes=(\d+)-(\d+)$/.exec(String(request.headers.range ?? ""));
    const base = { ...object.headers, "accept-ranges": "bytes", etag: `"${lib.sha256Hex(object.body).slice(0, 16)}"` };
    if (range) {
      const [start, end] = [Number(range[1]), Math.min(Number(range[2]), object.body.length - 1)];
      response.writeHead(206, { ...base, "content-range": `bytes ${start}-${end}/${object.body.length}`, "content-length": String(end - start + 1) });
      return void response.end(object.body.subarray(start, end + 1));
    }
    response.writeHead(200, { ...base, "content-length": String(object.body.length) });
    response.end(request.method === "HEAD" ? undefined : object.body);
  });

  return Promise.all([
    new Promise<number>((resolve) => api.listen(0, "127.0.0.1", () => resolve((api.address() as { port: number }).port))),
    new Promise<number>((resolve) => site.listen(0, "127.0.0.1", () => resolve((site.address() as { port: number }).port))),
  ]).then(([apiPort, sitePort]) => ({
    objects,
    endpoint: `http://127.0.0.1:${apiPort}`,
    publicBase: `http://127.0.0.1:${sitePort}`,
    close: () => {
      // fetch keeps connections alive; drop them so the servers really stop.
      api.closeAllConnections();
      site.closeAllConnections();
      api.close();
      site.close();
    },
  }));
}

test("publish → permanent URL serves it; versions immutable; rollback; public verification", async () => {
  const fakes = await startFakes();
  try {
    const client = lib.createR2Client({ endpoint: fakes.endpoint, bucket: "bucket", accessKeyId: "test-key-id", secretAccessKey: SECRET, region: "auto" });
    const baseUrl = fakes.publicBase;

    const v100 = await publishRelease(client, { bytes: fakeApk("A"), version: "1.0.0", build: 1, baseUrl, now: new Date("2026-10-01T00:00:00Z") });
    assert.equal(fakes.objects.get("Shashtna.apk")?.headers["content-type"], "application/vnd.android.package-archive");
    assert.equal(fakes.objects.get("Shashtna.apk")?.headers["cache-control"], "public, max-age=300, must-revalidate");
    assert.equal(fakes.objects.get("releases/v1.0.0/Shashtna.apk")?.headers["cache-control"], "public, max-age=31536000, immutable");

    const v101 = await publishRelease(client, { bytes: fakeApk("B"), version: "1.0.1", build: 2, notes: "fixes", baseUrl });
    assert.equal(lib.sha256Hex(fakes.objects.get("Shashtna.apk")!.body), v101.sha256, "same URL, new APK");
    assert.equal(JSON.parse(fakes.objects.get("latest.json")!.body.toString()).version, "1.0.1");
    assert.equal(fakes.objects.get("Shashtna.apk.sha256")!.body.toString(), `${v101.sha256}  Shashtna.apk\n`);

    // A published version cannot be silently replaced…
    await assert.rejects(publishRelease(client, { bytes: fakeApk("C"), version: "1.0.1", build: 9, baseUrl }), (error: Error & { code?: string }) => error.code === "EXISTS");
    assert.equal(lib.sha256Hex(fakes.objects.get("Shashtna.apk")!.body), v101.sha256, "failed upload leaves latest untouched");
    // …and an invalid file never reaches storage.
    await assert.rejects(publishRelease(client, { bytes: Buffer.from(`<!doctype html><title>Download</title>${"x".repeat(200)}`), version: "1.0.2", build: 3, baseUrl }), /Not an APK/);
    assert.ok(!fakes.objects.has("releases/v1.0.2/Shashtna.apk"));

    // Upload without promoting, then roll back to 1.0.0.
    await publishRelease(client, { bytes: fakeApk("D"), version: "1.1.0-beta.1", build: 4, makeLatest: false, baseUrl });
    assert.equal(lib.sha256Hex(fakes.objects.get("Shashtna.apk")!.body), v101.sha256, "--no-latest keeps the permanent URL");
    await promoteRelease(client, { version: "1.0.0", baseUrl });
    assert.equal(lib.sha256Hex(fakes.objects.get("Shashtna.apk")!.body), v100.sha256);
    assert.equal(JSON.parse(fakes.objects.get("releases/index.json")!.body.toString()).latest, "1.0.0");
    await assert.rejects(promoteRelease(client, { version: "9.9.9", baseUrl }), /does not exist/);

    // The public URL as Downloader sees it.
    const verified = await verifyPublic(baseUrl);
    assert.deepEqual(verified.problems, []);
    assert.equal(verified.latest?.version, "1.0.0");

    // A wrong secret is refused by storage (and reported without the secret).
    const intruder = lib.createR2Client({ endpoint: fakes.endpoint, bucket: "bucket", accessKeyId: "test-key-id", secretAccessKey: "wrong", region: "auto" });
    await assert.rejects(intruder.put("Shashtna.apk", fakeApk("X"), lib.apkHeaders("latest")), (error: Error) => /403/.test(error.message) && !error.message.includes("wrong"));
  } finally {
    fakes.close();
  }
});
