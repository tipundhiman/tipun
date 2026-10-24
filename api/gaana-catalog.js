// Read-only compatibility probe for the GaanaPy catalog search flow.
// Kept separate from the active music player until upstream search and
// authorized playback are both verified on the live deployment.
const CATALOG_SEARCH = 'https://gaana.com/apiv2';

const safeText = (value, limit = 160) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, limit) : '';

const normalizeTrack = row => {
  if (!row || typeof row !== 'object') return null;
  const key = safeText(row.seo || row.seokey, 120);
  if (!key || !/^[a-zA-Z0-9-]+$/.test(key)) return null;
  return {
    id: key,
    title: safeText(row.track_title || row.title || row.name || row.n),
    artist: safeText(row.artist_name || row.artist || row.subtitle),
    url: 'https://gaana.com/song/' + encodeURIComponent(key),
    playable: false
  };
};

async function searchCatalog(query, limit) {
  const endpoint = new URL(CATALOG_SEARCH);
  for (const [key, value] of Object.entries({
    country: 'IN', page: '0', secType: 'track', type: 'search', keyword: query
  })) endpoint.searchParams.set(key, value);

  // GaanaPy used POST for this endpoint. If a provider explicitly returns
  // "Method Not Allowed", retry the standard read-only GET method once.
  const request = method => fetch(endpoint, {
    method,
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
    redirect: 'error'
  });
  let response = await request('POST');
  if (response.status === 405) response = await request('GET');
  if (!response.ok || !(response.headers.get('content-type') || '').includes('json'))
    return { ok: false, status: 503, code: 'CATALOG_UNAVAILABLE' };

  const data = await response.json();
  const rows = data?.gr?.[0]?.gd;
  if (!Array.isArray(rows))
    return { ok: false, status: 503, code: 'CATALOG_FORMAT_CHANGED' };

  return {
    ok: true,
    status: 200,
    tracks: rows.slice(0, limit).map(normalizeTrack).filter(Boolean)
  };
}

export async function handleGaanaCatalog(req, res, { path, raw, send, rate }) {
  if (!path.startsWith('/api/catalog/gaana/')) return false;
  if (!['/api/catalog/gaana/status', '/api/catalog/gaana/search'].includes(path)) {
    send(res, 404, { error: 'Catalog route not found' });
    return true;
  }
  if (req.method !== 'GET') {
    send(res, 405, { error: 'Only GET requests are supported' });
    return true;
  }
  if (!rate(req, res)) return true;

  const query = path.endsWith('/status') ? 'music' : (raw.searchParams.get('q') || '').trim();
  const limit = path.endsWith('/status') ? 1 : 8;
  if (query.length < 2 || query.length > 80 || /[\u0000-\u001f\u007f]/.test(query)) {
    send(res, 400, { error: 'Search must be 2–80 characters' });
    return true;
  }

  try {
    const result = await searchCatalog(query, limit);
    if (!result.ok) {
      send(res, result.status, { ok: false, code: result.code, playable: false });
      return true;
    }
    send(res, 200, {
      ok: true,
      source: 'indian-catalog-experimental',
      playable: false,
      count: result.tracks.length,
      ...(path.endsWith('/status') ? {} : { tracks: result.tracks })
    });
  } catch {
    send(res, 503, { ok: false, code: 'CATALOG_UNAVAILABLE', playable: false });
  }
  return true;
}
