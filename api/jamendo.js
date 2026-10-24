/*
 * Jamendo read-only catalog integration.
 * Client ID is sufficient for search; the OAuth client secret must never reach
 * the browser. The account owner confirms they have the necessary usage rights.
 * Public availability follows the configured Client ID, with an emergency
 * disable switch for support or provider incidents.
 */

const setting = key => String(process.env[key] || '').trim();
const PAGE_SIZE = 30;
const pageCache = new Map();
const configured = () => /^[a-zA-Z0-9_-]{5,100}$/.test(setting('JAMENDO_CLIENT_ID'));
const enabled = () => configured() && setting('JAMENDO_CATALOG_DISABLED') !== 'true';

function trustedUrl(input, hosts) {
  try {
    const url = new URL(String(input || ''));
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host)) ? url.toString() : null;
  } catch { return null; }
}

function creativeCommonsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (!['https:', 'http:'].includes(url.protocol) || url.hostname !== 'creativecommons.org') return null;
    // BY and BY-SA can be used in a commercial listening context, subject to
    // the API terms and their individual attribution/share-alike requirements.
    if (!/^\/licenses\/by(?:-sa)?\/\d+(?:\.\d+)?\//.test(url.pathname)) return null;
    url.protocol = 'https:';
    return url.toString();
  } catch { return null; }
}

export function normalizeJamendoTrack(track) {
  if (!/^\d{1,14}$/.test(String(track?.id ?? ''))) return null;
  const audio = trustedUrl(track.audio, ['storage.jamendo.com']);
  const license = creativeCommonsUrl(track.license_ccurl);
  if (!audio || !license) return null;
  return {
    id: String(track.id),
    title: String(track.name || 'Untitled track').slice(0, 110),
    artist: String(track.artist_name || 'Independent artist').slice(0, 90),
    duration: Math.max(0, Math.min(7200, Number(track.duration) || 0)),
    cover: trustedUrl(track.image || track.album_image, ['usercontent.jamendo.com']),
    audio,
    license,
    source: `https://www.jamendo.com/track/${track.id}`
  };
}

async function jamendoLookup(query, offset = 0) {
  const cacheKey = `${query.toLowerCase()}:${offset}`;
  const cached = query ? pageCache.get(cacheKey) : null;
  if (cached?.expires > Date.now()) return cached.page;
  const url = new URL('https://api.jamendo.com/v3.0/tracks/');
  url.searchParams.set('client_id', setting('JAMENDO_CLIENT_ID'));
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', query ? String(PAGE_SIZE) : '1');
  if (query) url.searchParams.set('offset', String(offset));
  url.searchParams.set('include', 'licenses');
  url.searchParams.set('audioformat', 'mp31');
  url.searchParams.set('ccnc', 'false');
  url.searchParams.set('ccnd', 'false');
  if (query) url.searchParams.set('search', query);
  let data;
  for (let attempt = 0; attempt < (query ? 2 : 1); attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw Error('Jamendo HTTP ' + response.status);
    data = await response.json();
    if (data?.headers?.status !== 'success' || !Array.isArray(data.results)) throw Error('Jamendo returned an invalid response');
    // Jamendo occasionally returns an empty page for a normally populated
    // search. Retry just once before telling the visitor no tracks were found.
    if (data.results.length || attempt === 1 || !query) break;
  }
  const page = {
    items: data.results.map(normalizeJamendoTrack).filter(Boolean),
    hasMore: !!query && data.results.length === PAGE_SIZE,
    nextOffset: offset + PAGE_SIZE
  };
  if (query && page.items.length) {
    pageCache.set(cacheKey, { page, expires: Date.now() + 120000 });
    if (pageCache.size > 70) pageCache.delete(pageCache.keys().next().value);
  }
  return page;
}

export async function handleJamendoApi(req, res, { path, raw, send, rate, auth, isAdmin }) {
  if (!['/api/jamendo/status', '/api/jamendo/search', '/api/admin/jamendo/check'].includes(path)) return false;
  if (req.method !== 'GET') { send(res, 405, { error: 'Method not allowed' }); return true; }

  if (path === '/api/jamendo/status') {
    send(res, 200, { configured: configured(), publicCatalogEnabled: enabled(),
      note: enabled() ? 'Independent-artist discovery is available.' : 'Configure the Jamendo Client ID to enable discovery.' });
    return true;
  }

  if (!rate(req, res)) return true;
  if (path === '/api/admin/jamendo/check') {
    const user = await auth(req, res);
    if (!user) return true;
    if (!await isAdmin(user.id)) { send(res, 403, { error: 'Admin access required' }); return true; }
    if (!configured()) { send(res, 503, { error: 'Add JAMENDO_CLIENT_ID to Vercel environment variables.' }); return true; }
    try {
      const tracks = await jamendoLookup('');
      send(res, 200, { connected: true, publicCatalogEnabled: enabled(), sampleEligibleTracks: tracks.items.length,
        note: 'The connection works. Music usage remains subject to the account holder’s permissions and the individual track licenses.' });
    } catch {
      send(res, 502, { error: 'Could not verify Jamendo Client ID or availability.' });
    }
    return true;
  }

  if (!enabled()) {
    send(res, 503, { error: 'Jamendo catalog is not configured or temporarily disabled.' });
    return true;
  }
  const query = String(raw.searchParams.get('q') || '').trim().replace(/\s+/g, ' ');
  if (query.length < 2 || query.length > 80) {
    send(res, 400, { error: 'Enter a music search between 2 and 80 characters.' });
    return true;
  }
  const rawOffset = raw.searchParams.get('offset') || '0';
  if (!/^\d{1,5}$/.test(rawOffset) || Number(rawOffset) > 30000 || Number(rawOffset) % PAGE_SIZE !== 0) {
    send(res, 400, { error: 'Invalid music search page.' });
    return true;
  }
  try {
    const page = await jamendoLookup(query, Number(rawOffset));
    send(res, 200, { ...page, provider: 'Jamendo', note: 'Independent artists only. Karaoke/recording rights are not included.' });
  } catch {
    send(res, 502, { error: 'Jamendo search is temporarily unavailable. Please retry.' });
  }
  return true;
}
