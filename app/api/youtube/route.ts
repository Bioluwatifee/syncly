// app/api/youtube/route.ts
// Handles server-side YouTube Music API calls via YouTube Data API v3:
// - GET playlists for the authenticated user
// - GET tracks for a specific playlist
// - POST to create a new playlist with matched tracks

export async function GET(request: Request) {
  return Response.json({ message: "YouTube routes coming soon" });
}
