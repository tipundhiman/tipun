/*
 * Cloudflare R2 media + recoverable Supabase Storage migration.
 * Login and relational records intentionally remain in Supabase.
 * Legacy storage objects are NEVER deleted during migration.
 */
const LIMIT = 50 * 1024 * 1024;
const SONG_LIMIT = 20_000_000;
const DAILY_UPLOADS = 10;
const DAILY_BYTES = 100 * 1024 * 1024;
const TYPES = Object.freeze({
  'image/jpeg': ['jpg', 'image'],
  'image/png': ['png', 'image'],
  'image/webp': ['webp', 'image'],
  'image/gif': ['gif', 'image'],
  'video/mp4': ['mp4', 'video'],
  'video/webm': ['webm', 'video'],
  'audio/mpeg': ['mp3', 'audio'],
  'audio/wav': ['wav', 'audio'],
  'audio/ogg': ['ogg', 'audio']
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
const errorText = data => typeof data?.message === 'string' ? data.message : typeof data?.error === 'string' ? data.error : 'Storage service error';
const configured = env => Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY && env.SONGS_BUCKET);
const base = env => String(env.SUPABASE_URL || '').replace(/\/$/, '');
const storagePath = path => path.split('/').map(encodeURIComponent).join('/');

async function db(env, path, init = {}) {
  const response = await fetch(base(env) + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
      'content-type': 'application/json',
      ...init.headers
    },
    signal: AbortSignal.timeout(15000)
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = { message: raw.slice(0, 160) }; }
  if (!response.ok) throw new Error('Database: ' + errorText(data));
  return data;
}

async function authenticatedUser(request, env) {
  const match = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') || '');
  if (!match) return null;
  const response = await fetch(base(env) + '/auth/v1/user', {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: 'Bearer ' + match[1] },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return null;
  const user = await response.json();
  return UUID.test(user?.id || '') && user.email_confirmed_at !== null ? user : null;
}

async function requireAdmin(request, env) {
  const user = await authenticatedUser(request, env);
  if (!user) return { response: json(401, { error: 'Sign in required' }) };
  const rows = await db(env, 'admin_users?select=user_id&user_id=eq.' + user.id + '&limit=1');
  if (!Array.isArray(rows) || rows.length !== 1) return { response: json(403, { error: 'Admin only' }) };
  return { user };
}

function mediaKey(row, mime) {
  const descriptor = TYPES[mime];
  if (!UUID.test(row.id) || !UUID.test(row.owner) || !descriptor) throw new Error('Invalid media metadata');
  return `media/${row.owner}/${row.id}.${descriptor[0]}`;
}

async function upload(request, env) {
  if (request.method !== 'POST') return json(405, { error: 'Use POST' });
  const user = await authenticatedUser(request, env);
  if (!user) return json(401, { error: 'Sign in required' });
  const mime = (request.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const descriptor = TYPES[mime];
  const length = Number(request.headers.get('content-length'));
  const title = decodeURIComponent(request.headers.get('x-rhymeorbit-title') || '').trim();
  if (!descriptor) return json(415, { error: 'Unsupported media type' });
  if (!Number.isSafeInteger(length) || length < 1 || length > LIMIT) return json(413, { error: 'File must be 1 byte to 50 MB; a file length is required' });
  if (!title || title.length > 140) return json(400, { error: 'Caption must be 1–140 characters' });
  if (!request.body) return json(400, { error: 'File is empty' });

  // Authenticated accounts are also subject to an abuse cap (separate from music credits).
  if (env.MEDIA_UPLOAD_RATE_LIMITER) {
    const decision = await env.MEDIA_UPLOAD_RATE_LIMITER.limit({ key: user.id });
    if (!decision.success) return json(429, { error: 'Too many uploads. Please wait a minute.' });
  }
  const from = encodeURIComponent(new Date(Date.now() - 86400000).toISOString());
  const recent = await db(env, `creator_media?select=size_bytes&owner=eq.${user.id}&created_at=gte.${from}&limit=${DAILY_UPLOADS + 1}`);
  const bytesUsed = recent.reduce((sum, row) => sum + Math.max(0, Number(row.size_bytes) || 0), 0);
  if (recent.length >= DAILY_UPLOADS || bytesUsed + length > DAILY_BYTES)
    return json(429, { error: 'Daily media limit reached: 10 files or 100 MB in 24 hours.' });

  const id = crypto.randomUUID();
  const key = `media/${user.id}/${id}.${descriptor[0]}`;
  // R2 requires a known-length stream; transforming request.body strips that property.
  // Validate the declared size first, and verify R2's actual stored length immediately after upload.
  try { await env.SONGS_BUCKET.put(key, request.body, { httpMetadata: { contentType: mime } }); }
  catch (error) {
    await env.SONGS_BUCKET.delete(key).catch(() => {});
    throw error;
  }
  const object = await env.SONGS_BUCKET.head(key);
  if (!object || Number(object.size) !== length) {
    await env.SONGS_BUCKET.delete(key);
    return json(502, { error: 'Media verification failed; please retry' });
  }
  try {
    await db(env, 'creator_media', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id, owner: user.id, storage_path: 'r2:' + key, kind: descriptor[1], title, mime_type: mime, size_bytes: length })
    });
  } catch (err) {
    await env.SONGS_BUCKET.delete(key);
    throw err;
  }
  let warning = null;
  try {
    await db(env, 'community_posts', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: user.id, author_name: String(user.user_metadata?.name || user.user_metadata?.full_name || 'Creator').slice(0, 80), caption: title, media_path: key, media_type: descriptor[1], media_bucket: 'r2' })
    });
  } catch {
    warning = 'File saved to R2 and your Media gallery, but the Community post could not be created.';
  }
  return json(201, { id, storagePath: 'r2:' + key, publicUrl: '/api/media/file/' + id, warning });
}

async function file(request, env, id) {
  if (!['GET', 'HEAD'].includes(request.method)) return json(405, { error: 'Use GET or HEAD' });
  if (!UUID.test(id)) return json(404, { error: 'Not found' });
  const rows = await db(env, 'creator_media?select=id,owner,storage_path,mime_type&id=eq.' + id + '&limit=1');
  const item = rows?.[0];
  if (!item?.storage_path?.startsWith('r2:')) return json(404, { error: 'Not found' });
  const key = item.storage_path.slice(3);
  if (key !== mediaKey(item, item.mime_type)) return json(404, { error: 'Invalid media reference' });
  const head = await env.SONGS_BUCKET.head(key);
  if (!head) return json(404, { error: 'Media not found' });
  const size = Number(head.size);
  if (!Number.isSafeInteger(size) || size < 1 || size > LIMIT) return json(502, { error: 'Invalid media size' });
  const range = request.headers.get('range');
  let start = 0, end = size - 1;
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start < 0 || end < start)
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    end = Math.min(end, size - 1);
  }
  const headers = {
    'content-type': item.mime_type,
    'content-length': String(end - start + 1),
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=300',
    'x-content-type-options': 'nosniff',
    'content-disposition': 'inline'
  };
  if (range) headers['content-range'] = `bytes ${start}-${end}/${size}`;
  if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
  const object = await env.SONGS_BUCKET.get(key, range ? { range: { offset: start, length: end - start + 1 } } : undefined);
  if (!object) return json(404, { error: 'Media not found' });
  return new Response(object.body, { status: range ? 206 : 200, headers });
}

async function deleteMedia(request, env) {
  if (request.method !== 'POST') return json(405, { error: 'Use POST' });
  const user = await authenticatedUser(request, env);
  if (!user) return json(401, { error: 'Sign in required' });
  const payload = await request.json().catch(() => ({}));
  if (!UUID.test(payload.id || '')) return json(400, { error: 'Invalid media ID' });
  const rows = await db(env, 'creator_media?select=id,owner,storage_path,mime_type&id=eq.' + payload.id + '&owner=eq.' + user.id + '&limit=1');
  const item = rows?.[0];
  if (!item) return json(404, { error: 'Media not found' });
  const key = item.storage_path?.slice(3);
  if (!item.storage_path?.startsWith('r2:') || key !== mediaKey(item, item.mime_type)) return json(400, { error: 'Not R2 media' });
  // Remove the public post before its R2 object. The original data stays if the DB operation fails.
  await db(env, 'community_posts?user_id=eq.' + user.id + '&media_bucket=eq.r2&media_path=eq.' + encodeURIComponent(key), { method: 'DELETE' });
  await db(env, 'creator_media?id=eq.' + item.id + '&owner=eq.' + user.id, { method: 'DELETE' });
  try { await env.SONGS_BUCKET.delete(key); }
  catch { return json(200, { deleted: true, warning: 'Media record deleted; orphaned R2 object needs later cleanup' }); }
  return json(200, { deleted: true });
}

async function oldFiles(env) {
  const [media, songs] = await Promise.all([
    db(env, 'creator_media?select=id,owner,storage_path,kind,mime_type,size_bytes&order=created_at.asc&limit=1000'),
    db(env, 'generated_songs?select=id,user_id,task_id,storage_path,status&order=created_at.asc&limit=1000')
  ]);
  return {
    media: (media || []).filter(row => row.storage_path && !row.storage_path.startsWith('r2:')),
    songs: (songs || []).filter(row => row.storage_path && !row.storage_path.startsWith('r2:'))
  };
}

async function migrateOne(env, item, kind) {
  const isSong = kind === 'song';
  const bucket = isSong ? 'song-audio' : 'creator-media';
  const oldPath = item.storage_path;
  const mime = isSong ? (oldPath.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg') : item.mime_type;
  let key;
  if (isSong) {
    if (!UUID.test(item.user_id) || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.task_id || '')) throw new Error('Unrecognized song key; left unchanged');
    key = `songs/${item.user_id}/${item.task_id}.${mime === 'audio/ogg' ? 'ogg' : 'mp3'}`;
  } else {
    key = mediaKey(item, mime);
  }
  const download = await fetch(base(env) + '/storage/v1/object/' + (isSong ? 'authenticated/' : '') + bucket + '/' + storagePath(oldPath), {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY },
    signal: AbortSignal.timeout(30000)
  });
  if (!download.ok || !download.body) throw new Error('Original file unavailable; left unchanged');
  const declaredSize = Number(download.headers.get('content-length'));
  const max = isSong ? SONG_LIMIT : LIMIT;
  if (declaredSize > max) throw new Error('File exceeds R2 migration limit; left unchanged');
  // The first copy is non-destructive; verify the file size before modifying any references.
  await env.SONGS_BUCKET.put(key, download.body, { httpMetadata: { contentType: mime } });
  const copied = await env.SONGS_BUCKET.head(key);
  if (!copied || Number(copied.size) < 1 || Number(copied.size) > max ||
      (declaredSize > 0 && Number(copied.size) !== declaredSize) ||
      (!isSong && Number(item.size_bytes) > 0 && Number(copied.size) !== Number(item.size_bytes))) {
    throw new Error('Copy did not pass size verification; original references retained');
  }
  const table = isSong ? 'generated_songs' : 'creator_media';
  const changed = await db(env, table + '?id=eq.' + item.id + '&storage_path=eq.' + encodeURIComponent(oldPath) + '&select=id', {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ storage_path: 'r2:' + key })
  });
  if (!Array.isArray(changed) || changed.length !== 1) throw new Error('File copied, but its database record changed; original retained');
  if (!isSong) {
    try {
      await db(env, 'community_posts?user_id=eq.' + item.owner + '&media_bucket=eq.creator-media&media_path=eq.' + encodeURIComponent(oldPath), {
        method: 'PATCH', body: JSON.stringify({ media_path: key, media_bucket: 'r2' })
      });
    } catch (error) {
      // The legacy media is still in Supabase; revert its primary reference so a retry remains possible.
      await db(env, 'creator_media?id=eq.' + item.id + '&storage_path=eq.' + encodeURIComponent('r2:' + key), {
        method: 'PATCH', body: JSON.stringify({ storage_path: oldPath })
      });
      throw error;
    }
  }
  return { type: kind, id: item.id, verifiedBytes: Number(copied.size) };
}

async function migration(request, env) {
  if (!['GET', 'POST'].includes(request.method)) return json(405, { error: 'Use GET or POST' });
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const old = await oldFiles(env);
  const remaining = { media: old.media.length, songs: old.songs.length };
  if (request.method === 'GET') return json(200, { remaining, originalFilesPreserved: true });
  const next = old.media[0] || old.songs[0];
  if (!next) return json(200, { complete: true, remaining, originalFilesPreserved: true });
  const migrated = await migrateOne(env, next, old.media.length ? 'media' : 'song');
  return json(200, { migrated, remaining: { media: Math.max(0, remaining.media - (old.media.length ? 1 : 0)), songs: Math.max(0, remaining.songs - (old.media.length ? 0 : 1)) }, originalFilesPreserved: true });
}

export async function handleMediaStorageRequest(request, env) {
  const path = new URL(request.url).pathname;
  const matches = /^\/api\/media\/file\/([^/]+)$/.exec(path);
  if (!['/api/media/upload', '/api/media/delete', '/api/admin/storage-migration'].includes(path) && !matches) return null;
  if (!configured(env)) return json(503, { error: 'Cloudflare R2 or Supabase configuration unavailable' });
  try {
    if (path === '/api/media/upload') return await upload(request, env);
    if (path === '/api/media/delete') return await deleteMedia(request, env);
    if (path === '/api/admin/storage-migration') return await migration(request, env);
    return await file(request, env, matches[1]);
  } catch (err) {
    // Do not expose storage paths or backend service responses to visitors.
    console.error('Cloud storage request failed:', err?.message || 'Unknown error');
    return json(502, { error: 'Cloud storage operation failed. No original files were deleted.' });
  }
}
