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
import { handlePlayBillingReadiness } from './play-billing-readiness.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) {
      // Admin-only Google API authentication/catalog check. No payment can be made here.
      if (path === '/api/play-billing/readiness') return handlePlayBillingReadiness(request,env);
      // Play Billing is staged in Android v1.1, but digital checkout MUST
      // remain off until Play merchant setup, signed purchase verification,
      // acknowledgement, renewals and paid quota accounting are completed.
      if (path === '/api/play-billing/status') {
        return new Response(JSON.stringify({provider:'google_play',enabled:false,checkoutEnabled:false,reason:'Play Billing verification and paid entitlements are not configured'}),{
          status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
        });
      }
      if (path.startsWith('/api/play-billing/')) {
        return new Response(JSON.stringify({error:'Google Play paid purchases are not enabled; no payment was collected'}),{
          status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
        });
      }
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
