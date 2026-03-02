// app/api/spotify/route.ts
// Handles server-side Spotify API calls:
// - GET playlists for the authenticated user
// - GET tracks for a specific playlist
// - POST to create a new playlist with matched tracks

export async function GET(request: Request) {
  return Response.json({ message: "Spotify routes coming soon" });
}
