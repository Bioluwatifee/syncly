// app/api/apple/route.ts
// Handles Apple Music API calls via MusicKit:
// - Developer token generation (JWT signed with Apple private key)
// - GET playlists for the authenticated user
// - POST to create a new playlist with matched tracks

export async function GET(request: Request) {
  return Response.json({ message: "Apple Music routes coming soon" });
}
