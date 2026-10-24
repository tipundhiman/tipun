/*
 * Fetch Request / Response bridge for the existing Node-style API handlers.
 * Preserves byte-exact Razorpay webhook bodies for HMAC verification.
 */
import { Buffer } from 'node:buffer';

export const MAX_API_REQUEST_BYTES = 131_072;

async function readBoundedBody(request, maxBytes) {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const parts = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const part = Buffer.from(value);
      length += part.length;
      if (length > maxBytes) {
        await reader.cancel('Request body too large');
        const err = new Error('Request body too large');
        err.status = 413;
        throw err;
      }
      parts.push(part);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts, length);
}

function makeNodeLikeRequest(request, bytes) {
  const headers = Object.fromEntries(request.headers.entries());
  const realIp = request.headers.get('cf-connecting-ip');
  if (realIp) headers['x-forwarded-for'] = realIp;

  const url = new URL(request.url);
  return {
    method: request.method,
    url: url.pathname + url.search,
    headers,
    rawBody: bytes,
    socket: { remoteAddress: realIp || 'unknown' },
    async *[Symbol.asyncIterator]() {
      if (bytes.length) yield bytes;
    }
  };
}

function makeNodeLikeResponse(request) {
  let status = 200;
  const headers = new Headers();
  let chunks = [];
  let ended = false;
  const res = {
    get statusCode() { return status; },
    set statusCode(value) { status = Number(value); },
    get writableEnded() { return ended; },
    setHeader(key, value) { headers.set(key, String(value)); return this; },
    getHeader(key) { return headers.get(key); },
    writeHead(code, values = {}) {
      status = Number(code);
      for (const [key, value] of Object.entries(values)) {
        if (value !== undefined && value !== null) headers.set(key, String(value));
      }
      return this;
    },
    write(part) {
      if (ended) throw new Error('Response already finished');
      if (part !== undefined && part !== null)
        chunks.push(Buffer.isBuffer(part) ? part : Buffer.from(String(part)));
      return true;
    },
    end(part) {
      if (ended) return this;
      if (part !== undefined && part !== null) this.write(part);
      ended = true;
      return this;
    },
    toFetchResponse() {
      if (!ended) throw new Error('API handler did not finish its response');
      const content = chunks.length ? Buffer.concat(chunks) : null;
      const bodyAllowed = request.method !== 'HEAD' && ![204, 205, 304].includes(status);
      const response = new Response(bodyAllowed ? content : null, { status, headers });
      chunks = [];
      return response;
    }
  };
  return res;
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function forwardApiRequest(request, handler, maxBytes = MAX_API_REQUEST_BYTES) {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes)
    return jsonError(413, 'Request body too large');
  let bytes;
  try {
    bytes = await readBoundedBody(request, maxBytes);
  } catch (error) {
    if (error?.status === 413) return jsonError(413, 'Request body too large');
    return jsonError(400, 'Invalid request body');
  }
  const req = makeNodeLikeRequest(request, bytes);
  const res = makeNodeLikeResponse(request);
  try {
    await handler(req, res);
    return res.toFetchResponse();
  } catch (error) {
    console.error('[RhymeOrbit Cloudflare API] Request failed',
      request.method, new URL(request.url).pathname, error?.name || 'Error');
    return jsonError(500, 'Server request failed');
  }
}
