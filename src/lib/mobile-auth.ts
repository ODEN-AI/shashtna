import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

/** HttpOnly cookie that carries the website session token. */
export const SESSION_COOKIE = "shashtna_session";

export type MobileAuthPayload = {
  sub: number;
  role?: string;
  iat: number;
  exp: number;
  /** Console device id: present only on sessions created by a native shell's credential exchange. */
  did?: number;
};

function getAuthSecret() {
  const secret = String(process.env.AUTH_SECRET ?? "").trim();

  if (secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be configured and contain at least 32 characters.",
    );
  }

  return secret;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret())
    .update(value)
    .digest("base64url");
}

/**
 * Sign a session token. Normal sign-ins use the defaults. A Console device
 * session passes its device id, the time of the password sign-in it is
 * bound to (as `iat`, so the 7-day staff maximum and sign-out-everywhere
 * keep counting from that sign-in) and a shorter expiry.
 */
export function createAuthToken(userId: number, role?: string, device?: { deviceId: number; issuedAt: number; expiresAt: number }) {
  const now = Math.floor(Date.now() / 1000);

  const payload: MobileAuthPayload = device
    ? { sub: userId, role, iat: device.issuedAt, exp: device.expiresAt, did: device.deviceId }
    : {
        sub: userId,
        role,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
      };

  const encodedPayload = encode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: payload.exp * 1000,
  };
}

export function verifyAuthToken(token: string): MobileAuthPayload | null {
  try {
    const [encodedPayload, providedSignature] = token.split(".");

    if (!encodedPayload || !providedSignature) {
      return null;
    }

    const expectedSignature = sign(encodedPayload);
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const providedBuffer = Buffer.from(providedSignature, "utf8");

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(decode(encodedPayload)) as MobileAuthPayload;

    if (!Number.isInteger(payload.sub) || payload.sub <= 0) {
      return null;
    }

    if (
      !Number.isFinite(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    if (payload.did !== undefined && (!Number.isSafeInteger(payload.did) || payload.did <= 0)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Keyed digest for values that must be looked up but never stored raw
 * (login-throttle keys). Keyed with AUTH_SECRET so a database copy can't be
 * reversed by hashing candidate phone numbers.
 */
export function keyedDigest(value: string) {
  return createHmac("sha256", getAuthSecret()).update(`shashtna:v1:${value}`).digest("hex");
}

/** Verifier for a high-entropy random secret (device credentials). */
export function secretVerifier(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function sameDigest(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  return left.length === right.length && timingSafeEqual(left, right);
}

function unauthorized(
  message = "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.",
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function requireMobileAuth(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return {
      ok: false as const,
      response: unauthorized(),
    };
  }

  const payload = verifyAuthToken(match[1].trim());

  if (!payload) {
    return {
      ok: false as const,
      response: unauthorized(),
    };
  }

  return {
    ok: true as const,
    userId: payload.sub,
    role: payload.role,
  };
}
