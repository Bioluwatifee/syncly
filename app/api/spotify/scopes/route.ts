import { NextRequest, NextResponse } from "next/server";
import { getPlatformSession, getSessionIdFromRequest } from "@/lib/oauth-session";

export const dynamic = "force-dynamic";

const spotifyCookies = {
  access: "syncly_spotify_access_token",
  refresh: "syncly_spotify_refresh_token",
  expiresAt: "syncly_spotify_expires_at",
};

function getCanonicalAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  return "http://127.0.0.1:3000";
}

function getCanonicalHostLabel(): string {
  try {
    return new URL(getCanonicalAppOrigin()).host;
  } catch {
    return "127.0.0.1:3000";
  }
}

async function refreshSpotifyToken(refreshToken: string) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Spotify OAuth environment variables are missing.");
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const refreshResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!refreshResponse.ok) {
    const details = await refreshResponse.text().catch(() => "");
    throw new Error(`Spotify refresh failed (${refreshResponse.status}): ${details}`);
  }

  const payload = await refreshResponse.json();
  return {
    accessToken: String(payload?.access_token ?? ""),
    refreshToken: String(payload?.refresh_token ?? refreshToken),
    expiresIn: Number(payload?.expires_in ?? 3600),
  };
}

async function resolveAccessToken(request: NextRequest) {
  const sessionId = getSessionIdFromRequest(request);
  const serverSession = sessionId ? getPlatformSession(sessionId, "spotify") : null;
  const cookieAccess = request.cookies.get(spotifyCookies.access)?.value ?? "";
  const cookieRefresh = request.cookies.get(spotifyCookies.refresh)?.value ?? "";
  const cookieExpiresAtRaw = request.cookies.get(spotifyCookies.expiresAt)?.value;
  const now = Date.now();

  let accessToken = serverSession?.accessToken ?? cookieAccess;
  let refreshToken = serverSession?.refreshToken ?? cookieRefresh;
  let expiresAt = serverSession?.expiresAt ?? (cookieExpiresAtRaw ? Number(cookieExpiresAtRaw) : 0);

  if (!accessToken && !refreshToken) {
    return { accessToken: "", refreshToken: "", expiresAt: 0, refreshed: false };
  }

  let refreshed = false;
  if (!accessToken || expiresAt <= now + 10_000) {
    if (!refreshToken) {
      return { accessToken: "", refreshToken: "", expiresAt: 0, refreshed: false };
    }
    const refreshedPayload = await refreshSpotifyToken(refreshToken);
    accessToken = refreshedPayload.accessToken;
    refreshToken = refreshedPayload.refreshToken;
    expiresAt = Date.now() + refreshedPayload.expiresIn * 1000;
    refreshed = true;
  }

  return { accessToken, refreshToken, expiresAt, refreshed };
}

async function callSpotify(endpoint: string, accessToken: string) {
  const requestUrl = `https://api.spotify.com/v1${endpoint}`;
  if (process.env.NODE_ENV !== "production") {
    console.log("[spotify:scopes] request auth header", {
      endpoint,
      requestUrl,
      authScheme: "Bearer",
      accessTokenPrefix10: accessToken ? accessToken.slice(0, 10) : null,
      accessTokenPrefix: accessToken ? accessToken.slice(0, 20) : null,
      accessTokenLength: accessToken ? accessToken.length : 0,
      authorizationHeaderPreview: accessToken ? `Bearer ${accessToken.slice(0, 20)}...` : null,
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken.slice(0, 20)}...` : null,
      },
    });
  }
  const response = await fetch(requestUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!response.ok) {
    const headers = Object.fromEntries(response.headers.entries());
    console.error("[spotify:scopes] upstream error headers", {
      endpoint,
      requestUrl,
      status: response.status,
      statusText: response.statusText,
      headers,
      wwwAuthenticate: response.headers.get("www-authenticate"),
      retryAfter: response.headers.get("retry-after"),
      body: json,
    });
  }

  return {
    endpoint,
    status: response.status,
    ok: response.ok,
    body: json,
  };
}

async function callSpotifyAbsolute(requestUrl: string, accessToken: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[spotify:scopes] request auth header", {
      requestUrl,
      authScheme: "Bearer",
      accessTokenPrefix10: accessToken ? accessToken.slice(0, 10) : null,
      accessTokenPrefix: accessToken ? accessToken.slice(0, 20) : null,
      accessTokenLength: accessToken ? accessToken.length : 0,
      authorizationHeaderPreview: accessToken ? `Bearer ${accessToken.slice(0, 20)}...` : null,
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken.slice(0, 20)}...` : null,
      },
    });
  }

  const response = await fetch(requestUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!response.ok) {
    const headers = Object.fromEntries(response.headers.entries());
    console.error("[spotify:scopes] upstream error headers", {
      requestUrl,
      status: response.status,
      statusText: response.statusText,
      headers,
      wwwAuthenticate: response.headers.get("www-authenticate"),
      retryAfter: response.headers.get("retry-after"),
      body: json,
    });
  }

  return {
    endpoint: requestUrl,
    status: response.status,
    ok: response.ok,
    body: json,
  };
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    const resolved = await resolveAccessToken(request);
    const now = Date.now();
    const explicitPlaylistId = request.nextUrl.searchParams.get("playlistId")?.trim() ?? "";
    const clientId = process.env.SPOTIFY_CLIENT_ID?.trim() ?? "";
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim() ?? "";

    console.log("[spotify:scopes] token snapshot", {
      host: getCanonicalHostLabel(),
      appOrigin: getCanonicalAppOrigin(),
      clientIdPresent: Boolean(clientId),
      clientIdPrefix: clientId ? clientId.slice(0, 6) : null,
      redirectUri,
      appMode: process.env.NODE_ENV,
      accessTokenPresent: Boolean(resolved.accessToken),
      accessTokenPrefix10: resolved.accessToken ? resolved.accessToken.slice(0, 10) : null,
      accessTokenPrefix: resolved.accessToken ? resolved.accessToken.slice(0, 20) : null,
      accessTokenLength: resolved.accessToken ? resolved.accessToken.length : 0,
      refreshTokenPresent: Boolean(resolved.refreshToken),
      refreshed: resolved.refreshed,
      expiresAt: resolved.expiresAt,
      expiresAtIso: resolved.expiresAt ? new Date(resolved.expiresAt).toISOString() : null,
      expiresInSec: resolved.expiresAt ? Math.floor((resolved.expiresAt - now) / 1000) : null,
      grantedScopes:
        sessionId ? getPlatformSession(sessionId, "spotify")?.grantedScopes ?? null : null,
    });

    if (!resolved.accessToken) {
      return NextResponse.json({ error: "Spotify is not connected." }, { status: 401 });
    }

    const rawFetchUrl = "https://api.spotify.com/v1/playlists/7ic4UM1mz6EF1mrONr21Jb/tracks?limit=5";
    if (process.env.NODE_ENV !== "production") {
      console.log("[raw:fetch] request", {
        requestUrl: rawFetchUrl,
        headers: {
          Authorization: resolved.accessToken ? `Bearer ${resolved.accessToken.slice(0, 20)}...` : null,
          "Content-Type": "application/json",
        },
        accessTokenPrefix10: resolved.accessToken ? resolved.accessToken.slice(0, 10) : null,
        accessTokenLength: resolved.accessToken ? resolved.accessToken.length : 0,
      });
    }
    const rawFetchResponse = await fetch(rawFetchUrl, {
      headers: {
        Authorization: `Bearer ${resolved.accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const rawFetchText = await rawFetchResponse.text();
    let rawFetchBody: unknown = null;
    try {
      rawFetchBody = rawFetchText ? JSON.parse(rawFetchText) : null;
    } catch {
      rawFetchBody = rawFetchText;
    }
    console.log("[raw:fetch] status", rawFetchResponse.status, rawFetchBody);
    if (!rawFetchResponse.ok) {
      console.error("[raw:fetch] upstream error headers", {
        requestUrl: rawFetchUrl,
        status: rawFetchResponse.status,
        statusText: rawFetchResponse.statusText,
        headers: Object.fromEntries(rawFetchResponse.headers.entries()),
        wwwAuthenticate: rawFetchResponse.headers.get("www-authenticate"),
        retryAfter: rawFetchResponse.headers.get("retry-after"),
        body: rawFetchBody,
      });
    }

    const me = await callSpotify("/me", resolved.accessToken);
    const playlists = await callSpotify("/me/playlists?limit=10", resolved.accessToken);
    const meTracks = await callSpotify("/me/tracks?limit=1", resolved.accessToken);
    const currentUserId =
      me.ok && me.body && typeof me.body === "object"
        ? String((me.body as any).id ?? "")
        : "";
    const meTracksFirstItem =
      meTracks.ok && meTracks.body && typeof meTracks.body === "object" && Array.isArray((meTracks.body as any).items)
        ? ((meTracks.body as any).items as any[])[0] ?? null
        : null;
    const meTracksFirstTrackId = meTracksFirstItem?.track?.id ? String(meTracksFirstItem.track.id) : "";
    const meTracksFirstTrackProbe = meTracksFirstTrackId
      ? await callSpotify(`/tracks/${encodeURIComponent(meTracksFirstTrackId)}`, resolved.accessToken)
      : null;
    const playlistItems =
      playlists.ok && playlists.body && typeof playlists.body === "object" && Array.isArray((playlists.body as any).items)
        ? ((playlists.body as any).items as any[])
        : [];
    const ownedPlaylists = playlistItems
      .filter((playlist) => String(playlist?.owner?.id ?? "") === currentUserId)
      .slice(0, 3)
      .map((playlist) => ({
        id: String(playlist?.id ?? ""),
        name: String(playlist?.name ?? ""),
        ownerId: String(playlist?.owner?.id ?? ""),
        ownerName: String(playlist?.owner?.display_name ?? ""),
      }))
      .filter((playlist) => Boolean(playlist.id));

    const ownedPlaylistTrackProbes = ownedPlaylists.length > 0
      ? await Promise.all(
          ownedPlaylists.map(async (playlist) => {
            const tracksResponse = await callSpotify(
              `/playlists/${encodeURIComponent(playlist.id)}/tracks?limit=5`,
              resolved.accessToken
            );

            return {
              playlist,
              response: tracksResponse,
            };
          })
        )
      : [
          {
            playlist: null,
            response: {
              endpoint: "",
              status: 0,
              ok: false,
              body: { error: "No owned playlists found in /me/playlists response." },
            },
          },
        ];

    const candidatePlaylistId =
      explicitPlaylistId ||
      ownedPlaylists[0]?.id ||
      (playlistItems.length > 0 ? String(playlistItems[0]?.id ?? "") : "");
    const candidatePlaylistMeta = candidatePlaylistId
      ? await callSpotify(`/playlists/${encodeURIComponent(candidatePlaylistId)}`, resolved.accessToken)
      : null;
    const candidatePlaylistTracksHref =
      candidatePlaylistMeta?.ok &&
      candidatePlaylistMeta.body &&
      typeof candidatePlaylistMeta.body === "object" &&
      typeof (candidatePlaylistMeta.body as any)?.tracks?.href === "string"
        ? String((candidatePlaylistMeta.body as any).tracks.href)
        : "";
    const candidatePlaylistItemsProbe = candidatePlaylistId
      ? await callSpotify(
          `/playlists/${encodeURIComponent(candidatePlaylistId)}/items?limit=1`,
          resolved.accessToken
        )
      : null;
    const candidatePlaylistTracksMarketFromTokenProbe = candidatePlaylistId
      ? await callSpotify(
          `/playlists/${encodeURIComponent(candidatePlaylistId)}/tracks?limit=1&market=from_token`,
          resolved.accessToken
        )
      : null;
    const candidatePlaylistTracksMarketUsProbe = candidatePlaylistId
      ? await callSpotify(
          `/playlists/${encodeURIComponent(candidatePlaylistId)}/tracks?limit=1&market=US`,
          resolved.accessToken
        )
      : null;
    const candidatePlaylistTracksHrefProbe = candidatePlaylistTracksHref
      ? await callSpotifyAbsolute(candidatePlaylistTracksHref, resolved.accessToken)
      : null;

    const explicitPlaylistProbe = explicitPlaylistId
      ? await callSpotify(`/playlists/${encodeURIComponent(explicitPlaylistId)}/tracks?limit=100&offset=0`, resolved.accessToken)
      : null;

    console.log("[spotify:scopes] /me response", me);
    console.log("[spotify:scopes] authenticated spotify account", {
      email: me.ok && me.body && typeof me.body === "object" ? String((me.body as any).email ?? "") : "",
      id: me.ok && me.body && typeof me.body === "object" ? String((me.body as any).id ?? "") : "",
      displayName: me.ok && me.body && typeof me.body === "object" ? String((me.body as any).display_name ?? "") : "",
      accountId: me.ok && me.body && typeof me.body === "object" ? String((me.body as any).account_id ?? "") : "",
    });
    console.log("[spotify:scopes] /me/playlists response", playlists);
    console.log("[spotify:scopes] /me/tracks response", meTracks);
    console.log("[spotify:scopes] /tracks response from /me/tracks probe", {
      trackId: meTracksFirstTrackId || null,
      status: meTracksFirstTrackProbe?.status ?? 0,
      ok: meTracksFirstTrackProbe?.ok ?? false,
      endpoint: meTracksFirstTrackProbe?.endpoint ?? "",
      body: meTracksFirstTrackProbe?.body ?? { error: "No saved track returned from /me/tracks?limit=1." },
    });
    console.log("[spotify:scopes] candidate playlist metadata response", candidatePlaylistMeta);
    console.log("[spotify:scopes] candidate playlist tracks.href", {
      candidatePlaylistId: candidatePlaylistId || null,
      tracksHref: candidatePlaylistTracksHref || null,
    });
    console.log("[spotify:scopes] candidate playlist /items response", candidatePlaylistItemsProbe);
    console.log("[spotify:scopes] candidate playlist /tracks?limit=1&market=from_token response", candidatePlaylistTracksMarketFromTokenProbe);
    console.log("[spotify:scopes] candidate playlist /tracks?limit=1&market=US response", candidatePlaylistTracksMarketUsProbe);
    console.log("[spotify:scopes] candidate playlist tracks.href direct response", candidatePlaylistTracksHrefProbe);
    console.log("[spotify:scopes] owned playlists selected for tracks probe", {
      currentUserId,
      ownedPlaylists,
    });
    for (const probe of ownedPlaylistTrackProbes) {
      console.log("[spotify:scopes] owned playlist /tracks response", {
        playlistName: probe.playlist?.name ?? null,
        playlistOwnerName: probe.playlist?.ownerName ?? null,
        playlistOwnerId: probe.playlist?.ownerId ?? null,
        status: probe.response.status,
        ok: probe.response.ok,
        endpoint: probe.response.endpoint,
        body: probe.response.body,
      });
    }
    if (explicitPlaylistProbe) {
      console.log("[spotify:scopes] explicit playlist /tracks response", {
        playlistId: explicitPlaylistId,
        status: explicitPlaylistProbe.status,
        ok: explicitPlaylistProbe.ok,
        endpoint: explicitPlaylistProbe.endpoint,
        body: explicitPlaylistProbe.body,
      });
    }

    return NextResponse.json({
      token: {
        accessTokenPresent: true,
        refreshed: resolved.refreshed,
        expiresAt: resolved.expiresAt,
        expiresAtIso: resolved.expiresAt ? new Date(resolved.expiresAt).toISOString() : null,
      },
      rawFetch: {
        status: rawFetchResponse.status,
        ok: rawFetchResponse.ok,
        body: rawFetchBody,
      },
      me,
      playlists,
      meTracks,
      meTracksFirstTrackProbe,
      candidatePlaylistMeta,
      candidatePlaylistItemsProbe,
      candidatePlaylistTracksMarketFromTokenProbe,
      candidatePlaylistTracksMarketUsProbe,
      candidatePlaylistTracksHrefProbe,
      ownedPlaylists,
      ownedPlaylistTrackProbes,
      explicitPlaylistProbe,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Spotify scopes debug error";
    console.error("[spotify:scopes] failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
