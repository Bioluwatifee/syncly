import { NextRequest } from "next/server";
import { completeOAuthFlow } from "@/app/api/auth/route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return completeOAuthFlow(request);
}

