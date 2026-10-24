/*
 * RhymeOrbit Cloudflare Worker: public website and Node-compatible API.
 * This targets the existing Cloudflare application called tipun only.
 * On compatibility dates >= 2026-08-04, Node.js support is on by default.
 */
import { handleApi } from '../api/index.js';
import { forwardApiRequest } from './api-adapter.js';
import { handleMediaStorageRequest } from './media-storage.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) {
      const mediaResponse = await handleMediaStorageRequest(request, env);
      if (mediaResponse) return mediaResponse;
      return forwardApiRequest(request, handleApi, undefined, env);
    }
    return env.ASSETS.fetch(request);
  }
};
