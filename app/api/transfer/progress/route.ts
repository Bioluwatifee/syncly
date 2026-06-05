import { NextRequest, NextResponse } from "next/server";
import { getTransferProgress } from "@/lib/transfer-progress";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const transferId = request.nextUrl.searchParams.get("transferId")?.trim();
  if (!transferId) {
    return NextResponse.json({ error: "transferId is required." }, { status: 400 });
  }

  const progress = getTransferProgress(transferId);
  if (!progress) {
    return NextResponse.json({ error: "Transfer progress not found." }, { status: 404 });
  }

  return NextResponse.json(progress);
}

