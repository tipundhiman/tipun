/*
 * RhymeOrbit Cloudflare Worker: public website and Node-compatible API.
 * This targets the existing Cloudflare application called tipun only.
 * On compatibility dates >= 2026-08-04, Node.js support is on by default.
 */
import { handleApi } from '../api/index.js';
import { forwardApiRequest } from './api-adapter.js';
import { handleMediaStorageRequest } from './media-storage.js';
import { handlePrivateVideoRequest } from './private-videos.js';
import { handleCreatorLyricsRequest } from './creator-lyrics.js';
import { handleLicensedLyricsRequest } from './licensed-lyrics.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) {
      const licensedLyricsResponse = await handleLicensedLyricsRequest(request, env);
      if (licensedLyricsResponse) return licensedLyricsResponse;
      const lyricsResponse = await handleCreatorLyricsRequest(request, env);
      if (lyricsResponse) return lyricsResponse;
      const videoResponse = await handlePrivateVideoRequest(request, env);
      if (videoResponse) return videoResponse;
      const mediaResponse = await handleMediaStorageRequest(request, env);
      if (mediaResponse) return mediaResponse;
      return forwardApiRequest(request, handleApi, undefined, env);
    }
    return env.ASSETS.fetch(request);
  }
};
