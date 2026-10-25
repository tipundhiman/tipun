/* Licensed lyrics lookup for Sing Your Song.
 * NEVER enable from an API key alone: the contract must allow public lyric
 * display on RhymeOrbit, and synchronization is a separate licensed right.
 * No lyrics are cached, stored or generated from third-party audio here.
 */
const providerRoot = 'https://api.musixmatch.com/ws/1.1/';
const respond = (payload, status = 200) => Response.json(payload, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
const requests = new Map();
function rateLimited(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  if (requests.size > 500) for (const [key, item] of requests) if (now - item.since > 60000) requests.delete(key);
  const entry = requests.get(ip);
  if (!entry || now - entry.since > 60000) { requests.set(ip, { since: now, count: 1 }); return false; }
  entry.count++;
  return entry.count > 12;
}
async function musixmatch(method, params, key) {
  const url = new URL(method, providerRoot);
  url.searchParams.set('apikey', key);
  for (const [name, value] of Object.entries(params)) if (value) url.searchParams.set(name, String(value));
  const response = await fetch(url, { signal: AbortSignal.timeout(8500), headers: { Accept: 'application/json' } });
  if (!response.ok) return { error: response.status === 401 || response.status === 403 ? 'license' : 'provider' };
  const data = await response.json().catch(() => null);
  const status = Number(data?.message?.header?.status_code);
  if (status === 404) return { notFound: true };
  if (status === 401 || status === 402 || status === 403) return { error: 'license' };
  if (status !== 200) return { error: 'provider' };
  return { data: data.message?.body || {} };
}
function permittedText(input) {
  const text = typeof input === 'string' ? input.trim().slice(0, 16000) : '';
  // The demo API may return intentionally truncated/unlicensed words.
  if (!text || /\*{3,}\s*This Lyrics is NOT for Commercial use/i.test(text)) return '';
  return text;
}
export async function handleLicensedLyricsRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/lyrics/match') return null;
  if (request.method !== 'GET') return respond({ error: 'Method not allowed' }, 405);
  const title = (url.searchParams.get('title') || '').trim();
  const artist = (url.searchParams.get('artist') || '').trim();
  if (title.length < 2 || title.length > 140 || artist.length < 2 || artist.length > 140)
    return respond({ error: 'Song title and original artist are required.' }, 400);
  if (!env.MUSIXMATCH_API_KEY || env.MUSIXMATCH_DISPLAY_LICENSED !== 'true')
    return respond({ status: 'unavailable', reason: 'Licensed song lyrics are not active yet.' });
  if (rateLimited(request)) return respond({ error: 'Please wait before searching for more lyrics.' }, 429);

  const params = { q_track: title, q_artist: artist };
  const duration = Number(url.searchParams.get('duration'));
  const syncParams = { ...params, subtitle_format: 'lrc' };
  if (Number.isSafeInteger(duration) && duration > 15 && duration < 1800) {
    syncParams.f_subtitle_length = duration;
    syncParams.f_subtitle_length_max_deviation = 8;
  }
  try {
    if (env.MUSIXMATCH_SYNC_LICENSED === 'true') {
      const timed = await musixmatch('matcher.subtitle.get', syncParams, env.MUSIXMATCH_API_KEY);
      if (timed.error === 'license') return respond({ status: 'unavailable', reason: 'Lyrics provider authorization is unavailable.' }, 503);
      if (timed.data) {
        const subtitle = timed.data.subtitle;
        const lyrics = subtitle?.restricted === 1 ? '' : permittedText(subtitle?.subtitle_body);
        // Only .lrc timestamps allow us to call this synced karaoke.
        if (lyrics && /^\[\d{1,3}:\d{2}(?:\.\d+)?\]/m.test(lyrics))
          return respond({ status: 'ok', provider: 'Musixmatch', lyrics, timed: true,
            copyright: String(subtitle?.subtitle_copyright || '').slice(0, 500) });
      }
    }
    const plain = await musixmatch('matcher.lyrics.get', params, env.MUSIXMATCH_API_KEY);
    if (plain.error === 'license') return respond({ status: 'unavailable', reason: 'Lyrics provider authorization is unavailable.' }, 503);
    if (plain.error) return respond({ status: 'unavailable', reason: 'Lyrics provider is temporarily unavailable.' }, 502);
    const record = plain.data?.lyrics;
    const lyrics = record?.restricted === 1 ? '' : permittedText(record?.lyrics_body);
    if (!lyrics) return respond({ status: 'not_found', reason: 'Licensed lyrics are not available for this song.' });
    return respond({ status: 'ok', provider: 'Musixmatch', lyrics, timed: false,
      copyright: String(record.lyrics_copyright || '').slice(0, 500) });
  } catch {
    return respond({ status: 'unavailable', reason: 'Lyrics lookup timed out. Try again later.' }, 503);
  }
}
