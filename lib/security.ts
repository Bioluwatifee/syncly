import { NextRequest } from "next/server";

type RateBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateBucket>();

function getNow() {
  return Date.now();
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const now = getNow();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (existing.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { allowed: false, retryAfterSec };
  }

  existing.count += 1;
  return { allowed: true };
}

export function isSameOriginMutation(request: NextRequest): boolean {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const allowedOrigins = new Set<string>();
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    allowedOrigins.add("http://127.0.0.1:3000");
  }

  const addOrigin = (raw: string | null | undefined) => {
    if (!raw) return;
    try {
      allowedOrigins.add(new URL(raw).origin);
    } catch {
      // Ignore malformed values
    }
  };

  if (!isDev) {
    addOrigin(request.nextUrl.origin);
    addOrigin(process.env.NEXTAUTH_URL);
    addOrigin(process.env.NEXT_PUBLIC_APP_URL);
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    addOrigin(vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`);
  }

  const isAllowed = (raw: string | null): boolean => {
    if (!raw) return false;
    try {
      const candidate = new URL(raw).origin;
      return allowedOrigins.has(candidate);
    } catch {
      return false;
    }
  };

  if (isAllowed(originHeader)) return true;
  if (isAllowed(refererHeader)) return true;
  return false;
}
