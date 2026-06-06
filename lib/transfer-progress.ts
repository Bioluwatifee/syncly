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
  updatedAt: number;
};

const progressStore = new Map<string, TransferProgressSnapshot>();
const cancellationRequests = new Set<string>();

/** Mark a transfer for cancellation. The running transfer loop polls this flag
 *  and stops processing further tracks as soon as it notices the request. */
export function requestTransferCancellation(transferId: string) {
  cancellationRequests.add(transferId);
  const existing = progressStore.get(transferId);
  if (existing) {
    progressStore.set(transferId, { ...existing, cancelRequested: true, updatedAt: Date.now() });
  }
}

export function isTransferCancellationRequested(transferId: string): boolean {
  return cancellationRequests.has(transferId);
}

export function clearTransferCancellation(transferId: string) {
  cancellationRequests.delete(transferId);
}

export function upsertTransferProgress(transferId: string, patch: Partial<TransferProgressSnapshot>) {
  const existing = progressStore.get(transferId) ?? {
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
  progressStore.set(transferId, next);
  return next;
}

export function getTransferProgress(transferId: string): TransferProgressSnapshot | null {
  return progressStore.get(transferId) ?? null;
}

export function clearTransferProgress(transferId: string) {
  progressStore.delete(transferId);
  cancellationRequests.delete(transferId);
}

