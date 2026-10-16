// ===== Spotify Search Proxy (Firebase Cloud Function, 2nd gen) =====
//
// This is the ONLY place your Spotify client secret ever lives. The
// front-end calls this function with a plain search query; this function
// exchanges your client_id/client_secret for a short-lived Spotify access
// token (server-side, never exposed), runs the actual search against
// Spotify's Web API, and returns a trimmed-down JSON result the UI can
// render directly.
//
// Deploy instructions are in functions/README.md.

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const spotifyClientId = defineSecret('SPOTIFY_CLIENT_ID');
const spotifyClientSecret = defineSecret('SPOTIFY_CLIENT_SECRET');

// Cached in memory for the lifetime of this function instance, so we don't
// request a fresh token on every single search (Spotify tokens last ~1hr).
let cachedToken = null;
let tokenExpiresAt = 0;

async function getSpotifyToken(clientId, clientSecret) {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt) {
        return cachedToken;
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${basicAuth}`
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        throw new Error(`Spotify token request failed: ${response.status}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    // Refresh a little early (60s buffer) rather than cutting it exactly at expiry
    tokenExpiresAt = now + (data.expires_in - 60) * 1000;
    return cachedToken;
}

function simplifySpotifyResults(data) {
    const results = [];

    (data.tracks?.items || []).forEach((t) => {
        if (!t) return;
        results.push({
            type: 'track',
            id: t.id,
            name: t.name,
            subtitle: (t.artists || []).map((a) => a.name).join(', '),
            image: t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || null,
            embedPath: `track/${t.id}`
        });
    });

    (data.playlists?.items || []).forEach((p) => {
        if (!p) return;
        results.push({
            type: 'playlist',
            id: p.id,
            name: p.name,
            subtitle: `Playlist · ${p.owner?.display_name || 'Spotify'}`,
            image: p.images?.[0]?.url || null,
            embedPath: `playlist/${p.id}`
        });
    });

    (data.albums?.items || []).forEach((a) => {
        if (!a) return;
        results.push({
            type: 'album',
            id: a.id,
            name: a.name,
            subtitle: (a.artists || []).map((x) => x.name).join(', '),
            image: a.images?.[0]?.url || null,
            embedPath: `album/${a.id}`
        });
    });

    return results;
}

exports.spotifySearch = onRequest(
    { secrets: [spotifyClientId, spotifyClientSecret], cors: true },
    async (req, res) => {
        const query = req.query.q;
        const type = req.query.type || 'track,playlist,album';

        if (!query) {
            res.status(400).json({ error: 'Missing query parameter "q"' });
            return;
        }

        try {
            const token = await getSpotifyToken(spotifyClientId.value(), spotifyClientSecret.value());
            const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}&limit=10`;

            const spotifyResponse = await fetch(searchUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!spotifyResponse.ok) {
                throw new Error(`Spotify search failed: ${spotifyResponse.status}`);
            }

            const data = await spotifyResponse.json();
            res.json({ results: simplifySpotifyResults(data) });
        } catch (err) {
            console.error('spotifySearch error:', err);
            res.status(500).json({ error: 'Spotify search failed. Check the function logs.' });
        }
    }
);
