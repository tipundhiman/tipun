# Jamendo independent music — RhymeOrbit

Jamendo is for independent-artist music discovery in the existing **Listen & Chill** screen, not an unrestricted Bollywood or JioSaavn catalog. It does not supply licensed karaoke instrumentals or timestamp-aligned lyrics by default.

## Connect the account safely

1. In the deployment that serves `/api/*` (the canonical Vercel project), add `JAMENDO_CLIENT_ID` as an environment variable for Production, Preview and Development as needed. It is available in Jamendo's developer portal. Redeploy the existing project.
2. **Do not paste your Client Secret into chat or into `public/` JavaScript.** Jamendo's basic search/read API needs only `client_id`. Its `client_secret` is for OAuth workflows, which RhymeOrbit does not need here.
3. Visit `/api/jamendo/status`. After a valid Client ID is configured, it should return `configured: true` and `publicCatalogEnabled: false`. No user audio is served yet.
4. An authenticated RhymeOrbit admin can call `/api/admin/jamendo/check` to verify that the account works. This checks a sample upstream response without distributing the catalog publicly.
5. Ask Jamendo for **written approval** covering RhymeOrbit as a public brand with future paid memberships, streaming in-app, attribution and intended features. The free API is not automatically licensed for indirect business advantage. If karaoke/remixing/recording to backing tracks is planned, request those rights separately, for both music recordings and compositions.
6. **Only after written authorization**, set `JAMENDO_PUBLIC_PLAYBACK_LICENSE_APPROVED=true` in the same deployment and redeploy. The original Listen & Chill search then shows Jamendo results with artist credit and license links. No downloads, karaoke, file archiving or copying are offered.

Provider docs: https://developer.jamendo.com/v3.0/tracks and https://developer.jamendo.com/v3.0/authentication

The public catalog additionally filters to Creative Commons BY or BY-SA and HTTPS Jamendo stream domains. The track's separate license and all attribution obligations must still be obeyed. Do not set the approval flag based solely on owning a Client ID, disabling billing, or paying for another music-generation provider.
