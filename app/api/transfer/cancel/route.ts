import { NextRequest, NextResponse } from "next/server";
import { getTransferProgress, requestTransferCancellation } from "@/lib/transfer-progress";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { transferId?: string } | null = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const transferId = body?.transferId?.trim();
  if (!transferId) {
    return NextResponse.json({ error: "transferId is required." }, { status: 400 });
  }

  const progress = getTransferProgress(transferId);
  if (!progress) {
    // Nothing running server-side (already finished or never started) — treat as a no-op success.
    return NextResponse.json({ ok: true, alreadyFinished: true });
  }

  requestTransferCancellation(transferId);

  return NextResponse.json({ ok: true });
}
