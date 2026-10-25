// Public, read-only Audius catalog. No API credentials, scraped files or
// third-party audio proxy: playback stays on Audius's official stream route.
const AUDIUS_API = 'https://api.audius.co/v1';
const clean = (value, max = 140) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max).trim() : '';

export function normalizeAudiusTrack(track) {
  if (!track || typeof track !== 'object' || !track.is_available || track.is_streamable !== true) return null;
  const id = clean(track.id, 80);
  const title = clean(track.title);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !title) return null;
  const duration = Number(track.duration);
  return {
    id,
    title,
    artist: clean(track.user?.name || track.user?.handle || 'Audius creator'),
    duration: Number.isFinite(duration) && duration > 0 && duration < 86400 ? Math.round(duration) : null,
    audio: `${AUDIUS_API}/tracks/${encodeURIComponent(id)}/stream`,
    source: 'https://audius.co' + (typeof track.permalink === 'string' && /^\/[a-zA-Z0-9_/-]+$/.test(track.permalink) ? track.permalink : ''),
    provider: 'Audius',
    verifiedOriginal: false
  };
}

export async function handleAudiusCatalog(req, res, { path, raw, send, rate }) {
  if (!path.startsWith('/api/catalog/audius/')) return false;
  if (path !== '/api/catalog/audius/search') {
    send(res, 404, { error: 'Catalog route not found' });
    return true;
  }
  if (req.method !== 'GET') {
    send(res, 405, { error: 'Only GET requests are supported' });
    return true;
  }
  if (!rate(req, res)) return true;
  const query = (raw.searchParams.get('q') || '').trim();
  if (query.length < 2 || query.length > 80 || /[\u0000-\u001f\u007f]/.test(query)) {
    send(res, 400, { error: 'Search must be 2–80 characters' });
    return true;
  }
  const endpoint = new URL(AUDIUS_API + '/tracks/search');
  endpoint.searchParams.set('query', query);
  endpoint.searchParams.set('limit', '12');
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      redirect: 'error'
    });
    if (!response.ok || !(response.headers.get('content-type') || '').includes('json')) {
      send(res, 503, { ok: false, code: 'AUDIUS_UNAVAILABLE' });
      return true;
    }
    const data = await response.json();
    if (!Array.isArray(data?.data)) {
      send(res, 503, { ok: false, code: 'AUDIUS_FORMAT_CHANGED' });
      return true;
    }
    const tracks = data.data.map(normalizeAudiusTrack).filter(Boolean).slice(0, 12);
    send(res, 200, { ok: true, source: 'audius-community', count: tracks.length, tracks });
  } catch {
    send(res, 503, { ok: false, code: 'AUDIUS_UNAVAILABLE' });
  }
  return true;
}
