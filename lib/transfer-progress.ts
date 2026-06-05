export type TransferProgressStatus = "idle" | "running" | "done" | "error";

export type TransferProgressSnapshot = {
  transferId: string;
  status: TransferProgressStatus;
  playlistName?: string;
  sourceTrackCount?: number;
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
  overallStatus?: "success" | "partial" | "failure";
  result?: unknown;
  updatedAt: number;
};

const progressStore = new Map<string, TransferProgressSnapshot>();

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
}

