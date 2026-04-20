import { NextRequest, NextResponse } from "next/server";

const isTransferPublic = process.env.TRANSFER_PUBLIC === "true";

export function proxy(request: NextRequest) {
  const host = request.nextUrl.hostname;
  const isLocalDevHost = host === "localhost" || host === "127.0.0.1";

  if (!isTransferPublic && !isLocalDevHost && request.nextUrl.pathname.startsWith("/transfer")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/transfer/:path*"],
};
