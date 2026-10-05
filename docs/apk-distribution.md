# APK distribution — `https://download.shashtna.net/Shashtna.apk`

One permanent URL that always downloads the current Shashtna APK directly (no
landing page, no login, no JavaScript), with every release also kept at its
own versioned URL.

## A. Architecture

```
Phone / Android TV / Google TV / Downloader
        │  https://download.shashtna.net/Shashtna.apk
        ▼
Cloudflare edge (HTTPS, CDN cache, byte ranges)      ← R2 custom domain
        │
        ▼
Cloudflare R2 bucket  shashtna-downloads
  Shashtna.apk                     latest stable APK (copy of the promoted release)
  Shashtna.apk.sha256              its checksum
  latest.json                      latest release metadata (for in-app update checks)
  releases/index.json              all releases
  releases/v1.0.1/Shashtna.apk     immutable versioned APK
  releases/v1.0.1/Shashtna.apk.sha256
  releases/v1.0.1/release.json
        ▲
        │  S3 API, scoped write token (never in the app or the website)
scripts/apk/release.mjs  ←  your PC  or  GitHub Actions "APK release"
```

Why R2: zero egress fees (APK traffic from many TVs costs nothing per GB),
objects are served straight from Cloudflare's CDN with HTTPS, `Range`/`206`
(resumable downloads) and per-object headers, and the bucket is private for
writes. The website (Netlify) is not in the download path: Netlify functions
cannot stream 50 MB+ files and Netlify bandwidth is metered.

What each request returns:

| URL | Content-Type | Content-Disposition | Cache-Control |
|---|---|---|---|
| `/Shashtna.apk` | `application/vnd.android.package-archive` | `attachment; filename="Shashtna.apk"` | `public, max-age=300, must-revalidate` |
| `/releases/v1.0.1/Shashtna.apk` | same | `attachment; filename="Shashtna-1.0.1.apk"` | `public, max-age=31536000, immutable` |
| `/latest.json`, `/Shashtna.apk.sha256`, `/releases/index.json` | JSON / text | — | `public, max-age=60, must-revalidate` |

Caching: a versioned file never changes, so it is cached for a year. The
permanent URL is cached at most 5 minutes and revalidated by ETag afterwards;
when `CLOUDFLARE_ZONE_ID`/`CLOUDFLARE_API_TOKEN` are set, every publish/promote
also purges it from the CDN immediately. Nobody gets an old APK for more than
5 minutes, and usually not at all.

Errors: an unknown path answers `404` (plain, no bucket details). A failed or
interrupted upload never touches `Shashtna.apk`: versioned files are uploaded
first, and the permanent URL is switched only after they all succeed. A
version that already exists is refused (exit code 3) unless `--force`. Files
that are not APKs (an HTML page saved as `.apk`, an `.aab`, an empty file) are
refused before upload. Storage outages/timeouts end the tool with a clear
message and a non-zero exit code; credentials are never printed.

## B. One-time Cloudflare setup and DNS

**Requirement:** `shashtna.net` must use Cloudflare DNS (free plan is enough).
R2 custom domains only work for domains whose DNS is on Cloudflare in the same
account.

1. **Put `shashtna.net` on Cloudflare** (skip if it already is):
   Cloudflare dashboard → *Add a domain* → `shashtna.net` → Free plan. Check
   that the imported records include everything you use today (email MX/TXT,
   any website records), then at your registrar replace the nameservers with
   the two Cloudflare nameservers shown. Wait until the zone shows *Active*.
2. **Create the bucket:** R2 → *Create bucket* → name `shashtna-downloads`.
3. **Connect the domain:** bucket → *Settings* → *Custom Domains* → *Connect
   Domain* → `download.shashtna.net` → Connect.
   Cloudflare creates the DNS record itself. **You do not create a CNAME by
   hand.** In DNS → Records you will then see:

   | Type | Name | Target | Proxy |
   |---|---|---|---|
   | R2 (managed by R2) | `download` | `shashtna-downloads` | Proxied |

   Leave the bucket's `r2.dev` public URL **disabled**.
4. **Zone settings** (SSL/TLS and Security, for `shashtna.net`):
   - SSL/TLS → Edge Certificates → *Always Use HTTPS*: **On** (an `http://` link becomes one redirect to HTTPS).
   - Do **not** enable *Under Attack mode*, *Bot Fight Mode* or challenge rules for `download.shashtna.net`:
     they answer non-browser clients (Downloader, TVs) with an HTML challenge page instead of the APK.
   - Very old Android TV boxes (Android 7.0 and earlier) may not trust every certificate authority. If one
     fails with a TLS/certificate error, set SSL/TLS → Edge Certificates → *Universal SSL certificate
     authority* to Google Trust Services.
5. **Upload token** (write access, for the release tool only): R2 → *Manage R2 API Tokens* → *Create API token*
   → Permissions **Object Read & Write** → *Specify bucket(s)*: `shashtna-downloads` only → Create.
   Copy the *Access Key ID* and *Secret Access Key* (shown once) and your *Account ID*.
6. **Optional cache-purge token:** My Profile → API Tokens → *Create custom token* → permission
   *Zone → Cache Purge → Purge*, zone resources *Include → shashtna.net*. Copy the token and the
   zone's *Zone ID* (Overview page).

Public reads need no token. There is no public write path: uploads require the
scoped S3 key, which only the release tool and GitHub Actions hold.

**If `shashtna.net` cannot move to Cloudflare DNS:** an R2 custom domain is not
possible (CNAME-only setup needs a Business plan). The alternative is a
separate static host for the download domain; ask before choosing one, as it
changes the cost/bandwidth picture above.

## C. Environment variables

Never commit these; set them in your shell (or GitHub → Settings → Secrets and
variables → Actions). None are used by the website or the app.

| Variable | Required | Value |
|---|---|---|
| `R2_ACCOUNT_ID` | yes | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | yes | R2 token Access Key ID (Object Read & Write, this bucket only) |
| `R2_SECRET_ACCESS_KEY` | yes | R2 token Secret Access Key |
| `R2_BUCKET` | yes | `shashtna-downloads` |
| `APK_PUBLIC_BASE_URL` | no | default `https://download.shashtna.net` |
| `CLOUDFLARE_ZONE_ID` | no | zone ID of `shashtna.net` (instant cache purge) |
| `CLOUDFLARE_API_TOKEN` | no | Cache Purge token |

## D. Upload a new APK

Build the APK as usual (versionName / versionCode bumped). Then either:

**From your PC** (Node 22, repository root; PowerShell):

```powershell
$env:R2_ACCOUNT_ID="…"; $env:R2_ACCESS_KEY_ID="…"; $env:R2_SECRET_ACCESS_KEY="…"; $env:R2_BUCKET="shashtna-downloads"
npm run apk:release -- publish --file D:\builds\Shashtna.apk --version 1.0.1 --build 3 --notes "Fixes"
```

It prints the SHA-256, the versioned URL and confirms the permanent URL now
serves this version. Add `--no-latest` to upload without releasing it yet.

**From GitHub:** Actions → *APK release* → *Run workflow* → action `publish`,
`apk_url` = the HTTPS link of the built APK (e.g. the EAS build artifact URL),
`version`, `build`, optional notes → Run. The workflow downloads the APK,
publishes it and checks the public URL. (The workflow becomes available once
this file is on the default branch, and needs the secrets from section C.)

## E. Make a release the latest (or roll back)

```powershell
npm run apk:release -- promote --version 1.0.0     # Shashtna.apk now serves 1.0.0
npm run apk:release -- list                         # * marks the latest
```

or GitHub Actions → *APK release* → action `promote`, `version` `1.0.0`.
Promotion is a server-side copy (no re-upload); the versioned URLs never change.

## F. Test the direct download

```powershell
npm run apk:release -- verify        # checks everything below automatically
curl.exe -I https://download.shashtna.net/Shashtna.apk
curl.exe -s -r 0-3 -o NUL -w "%{http_code}\n" https://download.shashtna.net/Shashtna.apk
curl.exe -s https://download.shashtna.net/latest.json
```

Expected `curl.exe -I`:

```
HTTP/1.1 200 OK                      ← 200 directly, no 301/302, no HTML
Content-Type: application/vnd.android.package-archive
Content-Length: 4xxxxxxx
Content-Disposition: attachment; filename="Shashtna.apk"
Cache-Control: public, max-age=300, must-revalidate
Accept-Ranges: bytes
ETag: "…"
```

The range request prints `206` (resumable downloads work). To check
integrity after downloading: `certutil -hashfile Shashtna.apk SHA256` must
equal `sha256` in `latest.json` (also at `/Shashtna.apk.sha256`).

## G. Android TV / Google TV / Downloader

1. Install *Downloader* (by AFTVnews) from the Play Store / Amazon Appstore.
2. Allow it to install apps: Settings → Apps → Security & restrictions →
   *Unknown sources* (or *Install unknown apps*) → Downloader → Allow.
3. In Downloader's URL box type `download.shashtna.net/Shashtna.apk`
   (Downloader adds `https://`; typing the full URL also works) → Go.
4. Expected: the download starts immediately with a progress bar (no web
   page), then Android's installer opens for Shashtna. If it shows a web page
   instead, a Cloudflare security challenge is active on the domain (section B.4).

**Downloader codes** (e.g. `845217`): these are issued by AFTVnews, the
developer of Downloader, through their short-code service on aftvnews.com —
not by our website or by Cloudflare. You submit the URL and receive a numeric
code; you cannot pick the digits, and the code→URL mapping lives on their
servers (subject to their rules). Because `https://download.shashtna.net/Shashtna.apk`
never changes, the code you get **never needs to change between releases**.
Register the permanent URL (not a versioned one). Nothing in this repository
can create or reserve a code.

## Website and app integration

- Website download buttons: set Admin → Settings → `player.downloadUrl`
  (Player page) and/or Admin → Apps → the Shashtna app's *Download URL* to
  `https://download.shashtna.net/Shashtna.apk`. No code change is needed.
- In-app update check (future): read `https://download.shashtna.net/latest.json`
  (`version`, `build`, `releaseDate`, `sha256`, `downloadUrl`) and compare
  `build` with the installed versionCode.
