/* Private creator video library. Videos belong to a verified Supabase user and
 * are stored exclusively in the existing Cloudflare R2 SONGS_BUCKET binding.
 * Unlike /api/media/upload, saving a video never creates a community post. */
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_LIBRARY_BYTES = 350 * 1024 * 1024;
const MAX_LIBRARY_ITEMS = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[a-f0-9-]{36}$/i;
const reply = (code, payload) => new Response(JSON.stringify(payload), {
  status: code, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
const prefix = user => `videos/${user}/`;

async function userFor(request, env) {
  const match = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') || '');
  if (!match || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const response = await fetch(String(env.SUPABASE_URL).replace(/\/$/, '') + '/auth/v1/user', {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: 'Bearer ' + match[1] },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return null;
  const data = await response.json();
  return UUID.test(data?.id || '') && Boolean(data.email_confirmed_at) ? data.id : null;
}

const validType = type => ['video/webm', 'video/mp4'].includes((type || '').split(';')[0].toLowerCase());
const suffix = type => type.startsWith('video/mp4') ? 'mp4' : 'webm';

function describe(object) {
  const parts = /\/([a-f0-9-]{36})\.(mp4|webm)$/i.exec(object.key);
  if (!parts) return null;
  return {
    id: parts[1], title: String(object.customMetadata?.title || 'My animated video').slice(0, 100),
    createdAt: object.uploaded?.toISOString?.() || object.customMetadata?.created || null,
    duration: Number(object.customMetadata?.duration) || null,
    format: parts[2], size: Number(object.size) || 0,
    url: `/api/videos/file/${parts[1]}.${parts[2]}`
  };
}

async function listObjects(bucket, user) {
  const result = await bucket.list({ prefix: prefix(user), limit: 1000, include: ['customMetadata'] });
  if (result.truncated) throw new Error('Video library exceeded page limit');
  return result.objects.filter(x => /\/[a-f0-9-]{36}\.(webm|mp4)$/i.test(x.key));
}

async function upload(request, env, user) {
  if (request.method !== 'POST') return reply(405, { error: 'Use POST' });
  const mime = (request.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const size = Number(request.headers.get('content-length'));
  const title = (request.headers.get('x-video-title') || '').trim();
  const duration = Number(request.headers.get('x-video-duration'));
  if (!validType(mime)) return reply(415, { error: 'Only real WebM or MP4 video files can be stored' });
  if (!Number.isSafeInteger(size) || size < 1024 || size > MAX_VIDEO_BYTES || !request.body)
    return reply(413, { error: 'Video must be under 50 MB. Download larger videos to your device.' });
  if (!title || title.length > 100 || /[\u0000-\u001f]/.test(title)) return reply(400, { error: 'Enter a video title under 100 characters' });
  if (!Number.isFinite(duration) || duration < 1 || duration > 301) return reply(400, { error: 'Video duration must be 1–300 seconds' });
  if (env.MEDIA_UPLOAD_RATE_LIMITER) {
    const attempt = await env.MEDIA_UPLOAD_RATE_LIMITER.limit({ key: 'private-videos:' + user });
    if (!attempt.success) return reply(429, { error: 'Please wait before uploading another video' });
  }
  const existing = await listObjects(env.SONGS_BUCKET, user);
  const total = existing.reduce((sum, item) => sum + Number(item.size || 0), 0);
  if (existing.length >= MAX_LIBRARY_ITEMS || total + size > MAX_LIBRARY_BYTES)
    return reply(429, { error: 'Your private video library is full (30 videos / 350 MB). Download older videos before deleting them.' });
  const id = crypto.randomUUID();
  const key = prefix(user) + id + '.' + suffix(mime);
  try {
    await env.SONGS_BUCKET.put(key, request.body, {
      httpMetadata: { contentType: mime },
      customMetadata: { title, duration: String(duration), created: new Date().toISOString() }
    });
    const head = await env.SONGS_BUCKET.head(key);
    if (!head || Number(head.size) !== size) throw new Error('Upload did not pass size verification');
  } catch (error) {
    await env.SONGS_BUCKET.delete(key).catch(() => {});
    throw error;
  }
  return reply(201, { saved: true, id, url: `/api/videos/file/${id}.${suffix(mime)}` });
}

async function mediaFile(request, env, user, id, ext) {
  if (!['GET', 'HEAD'].includes(request.method)) return reply(405, { error: 'Use GET or HEAD' });
  if (!ID.test(id) || !UUID.test(id)) return reply(404, { error: 'Video not found' });
  const key = prefix(user) + id + '.' + ext;
  const head = await env.SONGS_BUCKET.head(key);
  if (!head) return reply(404, { error: 'Video not found' });
  const size = Number(head.size);
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_VIDEO_BYTES) return reply(502, { error: 'Invalid video file' });
  const range = request.headers.get('range');
  let start = 0, end = size - 1;
  if (range) {
    const parsed = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!parsed) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    start = Number(parsed[1]); end = parsed[2] ? Number(parsed[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start)
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    end = Math.min(end, size - 1);
  }
  const headers = {
    'content-type': ext === 'mp4' ? 'video/mp4' : 'video/webm',
    'content-length': String(end - start + 1),
    'accept-ranges': 'bytes', 'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff', 'content-disposition': 'inline'
  };
  if (range) headers['content-range'] = `bytes ${start}-${end}/${size}`;
  if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
  const file = await env.SONGS_BUCKET.get(key, range ? { range: { offset: start, length: end - start + 1 } } : undefined);
  if (!file) return reply(404, { error: 'Video not found' });
  return new Response(file.body, { status: range ? 206 : 200, headers });
}

export async function handlePrivateVideoRequest(request, env) {
  const path = new URL(request.url).pathname;
  const file = /^\/api\/videos\/file\/([a-f0-9-]{36})\.(webm|mp4)$/i.exec(path);
  if (!['/api/videos', '/api/videos/upload', '/api/videos/delete'].includes(path) && !file) return null;
  if (!env.SONGS_BUCKET || typeof env.SONGS_BUCKET.list !== 'function') return reply(503, { error: 'Private video storage is unavailable' });
  try {
    const user = await userFor(request, env);
    if (!user) return reply(401, { error: 'Please sign in with a verified account' });
    if (path === '/api/videos/upload') return upload(request, env, user);
    if (file) return mediaFile(request, env, user, file[1], file[2]);
    if (path === '/api/videos') {
      if (request.method !== 'GET') return reply(405, { error: 'Use GET' });
      const objects = await listObjects(env.SONGS_BUCKET, user);
      return reply(200, { items: objects.map(describe).filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
    }
    if (path === '/api/videos/delete') {
      if (request.method !== 'POST') return reply(405, { error: 'Use POST' });
      const payload = await request.json().catch(() => ({}));
      if (!UUID.test(payload.id || '') || !['webm', 'mp4'].includes(payload.format)) return reply(400, { error: 'Invalid video' });
      const key = prefix(user) + payload.id + '.' + payload.format;
      const head = await env.SONGS_BUCKET.head(key);
      if (!head) return reply(404, { error: 'Video not found' });
      await env.SONGS_BUCKET.delete(key);
      return reply(200, { deleted: true });
    }
  } catch (error) {
    console.error('Private video storage failed:', error?.message || 'Unknown error');
    return reply(502, { error: 'Private video storage request failed; please retry' });
  }
  return null;
}
