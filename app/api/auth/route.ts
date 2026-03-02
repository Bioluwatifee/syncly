// app/api/auth/route.ts
// OAuth callbacks for each platform will live here.
// These routes handle the redirect after a user authorises Tuneshift
// on Spotify, YouTube, or Apple Music.

export async function GET(request: Request) {
  return Response.json({ message: "Auth routes coming soon" });
}
