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
  const requestOrigin = request.nextUrl.origin;

  if (originHeader) {
    return originHeader === requestOrigin;
  }

  if (refererHeader) {
    try {
      const refererOrigin = new URL(refererHeader).origin;
      return refererOrigin === requestOrigin;
    } catch {
      return false;
    }
  }

  return false;
}
