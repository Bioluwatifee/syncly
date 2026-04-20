import { NextRequest, NextResponse } from "next/server";

const isTransferPublic = process.env.TRANSFER_PUBLIC === "true";

export function proxy(request: NextRequest) {
  if (!isTransferPublic && request.nextUrl.pathname.startsWith("/transfer")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/transfer/:path*"],
};
