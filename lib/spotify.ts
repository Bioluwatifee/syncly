import type { Playlist, Track } from "@/types";

const SPOTIFY_BASE = "https://api.spotify.com/v1";

async function spotifyFetch(endpoint: string, accessToken: string) {
  const res = await fetch(`${SPOTIFY_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Spotify API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function getSpotifyPlaylists(accessToken: string): Promise<Playlist[]> {
  const data = await spotifyFetch("/me/playlists?limit=50", accessToken);
  return data.items.map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    imageUrl: item.images?.[0]?.url,
    trackCount: item.tracks.total,
    platform: "spotify" as const,
  }));
}

export async function getSpotifyPlaylistTracks(
  playlistId: string,
  accessToken: string
): Promise<Track[]> {
  const data = await spotifyFetch(
    `/playlists/${playlistId}/items?limit=100`,
    accessToken
  );
  const items = Array.isArray(data?.items) ? data.items : [];
  if (process.env.NODE_ENV !== "production") {
    console.log("[lib:spotify] playlist items raw response", {
      playlistId,
      rawItemsLength: items.length,
      firstRawItem: items[0] ?? null,
      firstRawItemKeys: items[0] ? Object.keys(items[0]) : [],
      firstRawItemNestedItemKeys: items[0]?.item ? Object.keys(items[0].item) : [],
    });
  }

  const parsed: Track[] = [];
  let excludedNoTrack = 0;
  let excludedMissingIdOrName = 0;
  const parsedBefore = parsed.length;

  for (const item of items) {
    const track = item?.item ?? item?.track ?? item;
    if (!track) {
      excludedNoTrack += 1;
      continue;
    }
    if (!track?.id || !track?.name) {
      excludedMissingIdOrName += 1;
      continue;
    }

    parsed.push({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a: any) => a.name).join(", "),
      album: track.album.name,
      durationMs: track.duration_ms,
      imageUrl: track.album.images?.[0]?.url,
      platformId: track.id,
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[lib:spotify] playlist items parse diagnostics", {
      playlistId,
      rawItemsLength: items.length,
      parsedTracksOnPage: parsed.length - parsedBefore,
      totalParsedTracks: parsed.length,
      excludedNoTrack,
      excludedMissingIdOrName,
      firstParsedTrack: parsed[0] ?? null,
    });
  }

  return parsed;
}

export async function createSpotifyPlaylist(
  userId: string,
  name: string,
  trackUris: string[],
  accessToken: string
): Promise<string> {
  // Create the playlist
  const playlist = await fetch(`${SPOTIFY_BASE}/users/${userId}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, public: false }),
  }).then(r => r.json());

  // Add tracks in batches of 100 (Spotify limit)
  for (let i = 0; i < trackUris.length; i += 100) {
    const batch = trackUris.slice(i, i + 100);
    await fetch(`${SPOTIFY_BASE}/playlists/${playlist.id}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: batch }),
    });
  }

  return playlist.id;
}
