import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

/** HttpOnly cookie that carries the website session token. */
export const SESSION_COOKIE = "shashtna_session";

export type MobileAuthPayload = {
  sub: number;
  role?: string;
  iat: number;
  exp: number;
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

export function createAuthToken(userId: number, role?: string) {
  const now = Math.floor(Date.now() / 1000);

  const payload: MobileAuthPayload = {
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

    return payload;
  } catch {
    return null;
  }
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
