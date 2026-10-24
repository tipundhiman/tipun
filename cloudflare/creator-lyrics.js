/* Authenticated song lyrics sidecars + opt-in audio transcription.
 * Lyrics live beside songs in the existing private SONGS_BUCKET (R2).
 * No new database, public bucket, or GPU service is required. */
const MAX_LYRICS = 8000;
const MAX_AUDIO = 13 * 1024 * 1024; // Gemini inline requests must remain under 20 MB after base64.
const SONG_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});

async function verifiedUser(request, env) {
  const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '');
  if (!bearer || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const response = await fetch(String(env.SUPABASE_URL).replace(/\/$/, '') + '/auth/v1/user', {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: 'Bearer ' + bearer[1] },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return null;
  const user = await response.json();
  return USER_ID.test(user?.id || '') && Boolean(user?.email_confirmed_at) ? user.id : null;
}

async function ownsSong(user, taskId, env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const base = String(env.SUPABASE_URL).replace(/\/$/, '');
  const response = await fetch(base + '/rest/v1/generated_songs?user_id=eq.' + encodeURIComponent(user) +
    '&task_id=eq.' + encodeURIComponent(taskId) + '&select=task_id&limit=1', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw Error('Song ownership lookup failed');
  const rows = await response.json();
  return Array.isArray(rows) && rows.length === 1;
}

async function limitedBytes(request, max) {
  const declared = request.headers.get('content-length');
  if (declared !== null && Number(declared) > max) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  let size = 0;
  const parts = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel().catch(() => {}); return null; }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Uint8Array(await new Blob(parts).arrayBuffer());
}

const audioTypes = new Set(['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/x-m4a','audio/m4a','audio/aac','audio/flac','audio/x-flac','audio/webm']);

async function transcribe(request, env, user) {
  if (request.method !== 'POST') return json(405, { error: 'Use POST' });
  const mime = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!audioTypes.has(mime)) return json(415, { error: 'Choose an MP3, WAV, M4A, OGG, FLAC or other supported audio file.' });
  if (!env.GEMINI_API_KEY) return json(503, { error: 'Audio transcription is not configured.' });
  if (env.MEDIA_UPLOAD_RATE_LIMITER) {
    const result = await env.MEDIA_UPLOAD_RATE_LIMITER.limit({ key: 'transcribe:' + user });
    if (!result.success) return json(429, { error: 'Please wait before requesting another transcription.' });
  }
  const bytes = await limitedBytes(request, MAX_AUDIO);
  if (!bytes || bytes.byteLength < 100) return json(413, { error: 'Audio for transcription must be under 13 MB. Try a smaller MP3.' });
  // Do not persist the recording: it is only sent to the existing Gemini provider.
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  const model = String(env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  const query = {
    contents: [{ parts: [
      { text: 'Transcribe the sung or spoken words of this audio into song lyrics in their original language and script. Preserve line breaks. Do not invent words: if a line is unintelligible, mark [unclear]. Output ONLY the transcript, no explanations or markdown.' },
      { inline_data: { mime_type: ['audio/x-m4a','audio/m4a'].includes(mime) ? 'audio/mp4' : mime === 'audio/mp3' ? 'audio/mpeg' : mime === 'audio/x-flac' ? 'audio/flac' : mime, data: btoa(binary) } }
    ] }],
    generationConfig: { maxOutputTokens: 4800, temperature: 0 }
  };
  const result = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(query), signal: AbortSignal.timeout(65000)
  });
  if (!result.ok) {
    console.warn('Creator transcription provider status:', result.status);
    return json(result.status === 429 ? 429 : 502, { error: result.status === 429 ? 'AI transcription quota is busy. Try later.' : 'AI could not transcribe this audio. Try a clear, shorter vocal recording.' });
  }
  const payload = await result.json();
  const lyrics = String((payload.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('\n')).trim().slice(0, MAX_LYRICS);
  if (!lyrics) return json(422, { error: 'No clear words found. You can type or generate lyrics instead.' });
  return json(200, { lyrics, provider: 'Gemini', reviewRequired: true });
}

export async function handleCreatorLyricsRequest(request, env) {
  const url = new URL(request.url);
  if (!['/api/music/lyrics', '/api/lyrics/transcribe'].includes(url.pathname)) return null;
  if (!env.SONGS_BUCKET || typeof env.SONGS_BUCKET.get !== 'function') return json(503, { error: 'Private R2 song storage is unavailable.' });
  try {
    const user = await verifiedUser(request, env);
    if (!user) return json(401, { error: 'Sign in with a verified RhymeOrbit account.' });
    if (url.pathname === '/api/lyrics/transcribe') return transcribe(request, env, user);
    if (!['GET', 'POST'].includes(request.method)) return json(405, { error: 'Use GET or POST' });
    let id, lyrics;
    if (request.method === 'GET') id = url.searchParams.get('taskId');
    else {
      const bytes = await limitedBytes(request, 25000);
      if (!bytes) return json(413, { error: 'Lyrics request is too large.' });
      const input = JSON.parse(new TextDecoder().decode(bytes));
      id = input.taskId;
      lyrics = input.lyrics;
    }
    if (typeof id !== 'string' || !SONG_ID.test(id)) return json(400, { error: 'Invalid song ID.' });
    if (!await ownsSong(user, id, env)) return json(404, { error: 'Song not found in your account.' });
    const key = `song-lyrics/${user}/${id}.json`;
    if (request.method === 'GET') {
      const object = await env.SONGS_BUCKET.get(key);
      if (!object) return json(200, { lyrics: '', saved: false });
      if (object.size > 24000) return json(502, { error: 'Invalid lyrics file.' });
      const saved = JSON.parse(await object.text());
      return json(200, { lyrics: String(saved.lyrics || '').slice(0, MAX_LYRICS), saved: true, updatedAt: saved.updatedAt });
    }
    if (typeof lyrics !== 'string' || lyrics.length > MAX_LYRICS) return json(400, { error: 'Lyrics must be under 8,000 characters.' });
    const updatedAt = new Date().toISOString();
    await env.SONGS_BUCKET.put(key, JSON.stringify({ lyrics, updatedAt }), { httpMetadata: { contentType: 'application/json' } });
    return json(200, { saved: true, updatedAt });
  } catch (error) {
    console.warn('Private creator lyrics request:', error?.message || 'Unknown error');
    return json(503, { error: 'Creator lyrics service unavailable. Please retry.' });
  }
}
