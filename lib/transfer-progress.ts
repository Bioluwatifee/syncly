import { Redis } from "@upstash/redis";

export type TransferProgressStatus = "idle" | "running" | "done" | "error" | "cancelled";

export type TrackResultSnapshot = {
  id: string;
  name: string;
  artist: string;
  imageUrl?: string;
  status: "pending" | "success" | "failed";
  failureReason?: string;
};

export type TransferProgressSnapshot = {
  transferId: string;
  status: TransferProgressStatus;
  playlistName?: string;
  sourceTrackCount?: number;
  trackResults?: TrackResultSnapshot[];
  processedTrackCount?: number;
  transferredCount?: number;
  failedCount?: number;
  batchIndex?: number;
  totalBatches?: number;
  batchProcessedCount?: number;
  batchSize?: number;
  currentTrackName?: string;
  currentTrackArtist?: string;
  currentTrackIndex?: number;
  currentTrackTotal?: number;
  targetPlaylistId?: string | null;
  targetPlaylistUrl?: string | null;
  transferDurationMs?: number;
  completedAt?: string;
  error?: string;
  overallStatus?: "success" | "partial" | "failure" | "cancelled";
  result?: unknown;
  cancelRequested?: boolean;
  statusMessage?: string;
  updatedAt: number;
};

// ─── Store configuration ─────────────────────────────────────────────────────
//
// Progress and cancellation live in Upstash Redis (provisioned through the
// Vercel Marketplace — "Vercel KV" was retired in Dec 2024 and migrated to
// Upstash). A shared store is required because the transfer POST and the
// progress GET run as SEPARATE serverless instances in production and do not
// share process memory.
//
// If the Upstash env vars are absent (local dev before provisioning, or CI),
// everything transparently falls back to the previous in-process Maps, so local
// behaviour is unchanged and nothing hard-fails without a Redis instance.

const TTL_SECONDS = 60 * 60; // ~1 hour — rows self-expire, no cleanup job needed
const PROGRESS_KEY = (id: string) => `syncly:transfer:progress:${id}`;
const CANCEL_KEY = (id: string) => `syncly:transfer:cancel:${id}`;

/** How often a throttled progress write is actually pushed to Redis. */
const FLUSH_INTERVAL_MS = 700;
/** How long a cancellation lookup is cached before re-reading Redis. */
const CANCEL_CHECK_TTL_MS = 1_000;

function resolveRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch (error) {
    console.error("[transfer-progress] failed to construct Redis client; falling back to memory", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

let redisClient: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redisClient === undefined) {
    redisClient = resolveRedis();
    console.log("[transfer-progress] store backend", {
      backend: redisClient ? "upstash-redis" : "in-memory (no UPSTASH_REDIS_REST_* env vars)",
    });
  }
  return redisClient;
}

export function isSharedStoreConfigured(): boolean {
  return getRedis() !== null;
}

// ─── Local state ─────────────────────────────────────────────────────────────
// `localCache` is the authoritative in-process view of a transfer's progress.
// Every upsert merges into it synchronously so repeated upserts never need a
// network read to merge correctly. It doubles as the whole store when Redis is
// not configured.
const localCache = new Map<string, TransferProgressSnapshot>();
const localCancellations = new Set<string>();

const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastFlushAt = new Map<string, number>();
const cancelCheckCache = new Map<string, { value: boolean; checkedAt: number }>();

function parseSnapshot(raw: unknown): TransferProgressSnapshot | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as TransferProgressSnapshot;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as TransferProgressSnapshot;
  return null;
}

/** Writes the current local snapshot to Redis immediately. Never throws. */
async function writeSnapshot(transferId: string): Promise<void> {
  const redis = getRedis();
  const snapshot = localCache.get(transferId);
  if (!redis || !snapshot) return;
  try {
    await redis.set(PROGRESS_KEY(transferId), JSON.stringify(snapshot), { ex: TTL_SECONDS });
    lastFlushAt.set(transferId, Date.now());
  } catch (error) {
    // Progress is best-effort telemetry: the final result always travels in the
    // POST response payload, so a failed write must never break a transfer.
    console.warn("[transfer-progress] Redis write failed (continuing)", {
      transferId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Merges `patch` into the transfer's snapshot and schedules a throttled write.
 *
 * Deliberately synchronous and fire-and-forget: this is called ~16 times per
 * transfer including inside the per-track loop, and awaiting every call would
 * add a network round-trip per track to a transfer already bounded by the 300s
 * function timeout. Writes coalesce to at most one per FLUSH_INTERVAL_MS.
 *
 * Call `flushTransferProgress` at terminal states to guarantee the last write.
 */
export function upsertTransferProgress(transferId: string, patch: Partial<TransferProgressSnapshot>) {
  const existing = localCache.get(transferId) ?? {
    transferId,
    status: "idle" as const,
    updatedAt: Date.now(),
  };
  const next = {
    ...existing,
    ...patch,
    transferId,
    updatedAt: Date.now(),
  } satisfies TransferProgressSnapshot;
  localCache.set(transferId, next);

  if (getRedis()) scheduleFlush(transferId);
  return next;
}

function scheduleFlush(transferId: string) {
  if (flushTimers.has(transferId)) return; // a write is already queued

  const elapsed = Date.now() - (lastFlushAt.get(transferId) ?? 0);
  if (elapsed >= FLUSH_INTERVAL_MS) {
    void writeSnapshot(transferId);
    return;
  }

  const timer = setTimeout(() => {
    flushTimers.delete(transferId);
    void writeSnapshot(transferId);
  }, FLUSH_INTERVAL_MS - elapsed);
  // Don't hold the process open for a pending progress write.
  if (typeof timer === "object" && typeof (timer as any).unref === "function") {
    (timer as any).unref();
  }
  flushTimers.set(transferId, timer);
}

/**
 * Forces any pending progress write to land now. Await this at terminal states
 * (done / error / cancelled) so the final snapshot is never lost to throttling.
 */
export async function flushTransferProgress(transferId: string): Promise<void> {
  const timer = flushTimers.get(transferId);
  if (timer) {
    clearTimeout(timer);
    flushTimers.delete(transferId);
  }
  await writeSnapshot(transferId);
}

export async function getTransferProgress(transferId: string): Promise<TransferProgressSnapshot | null> {
  const redis = getRedis();
  if (!redis) return localCache.get(transferId) ?? null;

  try {
    const raw = await redis.get(PROGRESS_KEY(transferId));
    const parsed = parseSnapshot(raw);
    if (parsed) {
      // Surface a cancel request even if it landed after the last progress write.
      const cancelled = await readCancelFlag(transferId);
      return cancelled ? { ...parsed, cancelRequested: true } : parsed;
    }
  } catch (error) {
    console.warn("[transfer-progress] Redis read failed; falling back to local cache", {
      transferId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return localCache.get(transferId) ?? null;
}

export async function clearTransferProgress(transferId: string): Promise<void> {
  const timer = flushTimers.get(transferId);
  if (timer) {
    clearTimeout(timer);
    flushTimers.delete(transferId);
  }
  localCache.delete(transferId);
  localCancellations.delete(transferId);
  lastFlushAt.delete(transferId);
  cancelCheckCache.delete(transferId);

  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(PROGRESS_KEY(transferId), CANCEL_KEY(transferId));
  } catch (error) {
    console.warn("[transfer-progress] Redis delete failed (continuing)", {
      transferId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── Cancellation ────────────────────────────────────────────────────────────
// Previously an in-process Set, which meant cancel silently did nothing in
// production: the cancel route and the running transfer loop are different
// serverless instances. The flag now lives in Redis alongside the progress row.

/** Mark a transfer for cancellation. The running transfer loop polls this flag
 *  and stops processing further tracks as soon as it notices the request. */
export async function requestTransferCancellation(transferId: string): Promise<void> {
  localCancellations.add(transferId);
  cancelCheckCache.set(transferId, { value: true, checkedAt: Date.now() });

  const existing = localCache.get(transferId);
  if (existing) {
    localCache.set(transferId, { ...existing, cancelRequested: true, updatedAt: Date.now() });
  }

  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(CANCEL_KEY(transferId), "1", { ex: TTL_SECONDS });
  } catch (error) {
    console.warn("[transfer-progress] Redis cancel write failed", {
      transferId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function readCancelFlag(transferId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return localCancellations.has(transferId);
  try {
    const raw = await redis.get(CANCEL_KEY(transferId));
    return raw !== null && raw !== undefined;
  } catch {
    return localCancellations.has(transferId);
  }
}

/**
 * Checks whether cancellation was requested.
 *
 * Result is cached for CANCEL_CHECK_TTL_MS because the transfer loop calls this
 * once per track — without the cache a 117-track transfer would issue 117 extra
 * round-trips. A cancel is therefore noticed within ~1s, which is well inside
 * acceptable UX for a button press.
 */
export async function isTransferCancellationRequested(transferId: string): Promise<boolean> {
  if (localCancellations.has(transferId)) return true;

  const cached = cancelCheckCache.get(transferId);
  if (cached && Date.now() - cached.checkedAt < CANCEL_CHECK_TTL_MS) {
    return cached.value;
  }

  const value = await readCancelFlag(transferId);
  cancelCheckCache.set(transferId, { value, checkedAt: Date.now() });
  if (value) localCancellations.add(transferId);
  return value;
}

export async function clearTransferCancellation(transferId: string): Promise<void> {
  localCancellations.delete(transferId);
  cancelCheckCache.delete(transferId);

  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(CANCEL_KEY(transferId));
  } catch (error) {
    console.warn("[transfer-progress] Redis cancel delete failed (continuing)", {
      transferId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
