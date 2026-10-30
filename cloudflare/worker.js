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
import { serveAppAssetLinks } from './asset-links.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/.well-known/assetlinks.json') return serveAppAssetLinks(request, env);
    if (path.startsWith('/api/')) {
      // Edge-level cost control: 6 AI generation requests/minute per Cloudflare
      // client IP, on top of the atomic per-user Supabase monthly song cap.
      // Never use the user-controlled x-forwarded-for header as an identity.
      if (path === '/api/music/generate' && request.method === 'POST' && env.MUSIC_GENERATION_RATE_LIMITER) {
        const clientIp=String(request.headers.get('cf-connecting-ip')||'unknown').slice(0,90);
        try{
          const limit=await env.MUSIC_GENERATION_RATE_LIMITER.limit({key:'music:'+clientIp});
          if(!limit.success)return new Response(JSON.stringify({error:'Too many song requests. Try again shortly.'}),{
            status:429,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Retry-After':'60'}
          });
        }catch{
          // Fail closed for expensive operations when abuse control is down.
          return new Response(JSON.stringify({error:'Music generation protection is temporarily unavailable'}),{
            status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
          });
        }
      }
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
