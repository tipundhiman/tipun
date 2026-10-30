/*
 * RhymeOrbit Android Digital Asset Links.
 * The SHA-256 must be copied from Google Play Console > App integrity >
 * App signing key certificate (NOT the upload key certificate).
 * Cloudflare runtime variable PLAY_APP_SIGNING_SHA256 (public certificate hash).
 * This server-side config avoids committing an unverified fingerprint.
 */
export const APP_PACKAGE='in.rhymeorbit.app';
const fingerprintPattern=/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
export function assetLinksForFingerprint(value){
 const fingerprint=String(value||'').trim().toUpperCase().replace(/-/g,':');
 if(!fingerprintPattern.test(fingerprint))return null;
 return [{relation:['delegate_permission/common.handle_all_urls'],target:{
  namespace:'android_app',
  package_name:APP_PACKAGE,
  sha256_cert_fingerprints:[fingerprint]
 }}];
}
export async function serveAppAssetLinks(request,env){
 const data=assetLinksForFingerprint(env.PLAY_APP_SIGNING_SHA256);
 if(!data){
  // Preserve any asset/file supplied independently by Cloudflare if this
  // environment has not received the Play signing certificate yet.
  return env.ASSETS.fetch(request);
 }
 return new Response(JSON.stringify(data),{
  status:200,
  headers:{
   'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'public, max-age=300',
   'X-Content-Type-Options':'nosniff'
  }
 });
}
