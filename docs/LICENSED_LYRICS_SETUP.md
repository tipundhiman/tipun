# Licensed Hindi-song lyrics for Sing Your Song

The existing Sing Your Song Audius player now checks `/api/lyrics/match` when a
track is selected. The endpoint **does not expose the provider key**, store
licensed lyrics, or extract audio from Audius. It remains intentionally
inactive until display rights are approved and configured.

## Provider and authorization

The implementation uses the official Musixmatch Lyrics API:

- API documentation and signup: https://developer.musixmatch.com/
- Official API collection: https://www.postman.com/musixmatch-dev/musixmatch-apis/collection/pqm8o6w/lyrics-api
- API calls: `matcher.lyrics.get`, optionally `matcher.subtitle.get` for LRC.

Before enabling this on a public/commercial website, get written confirmation
that the purchased plan permits **full commercial song-lyrics display on
RhymeOrbit.in in its target territories**. A developer or demo key alone does
not establish permission. Confirm required attribution, reporting, tracking,
regional restrictions and caching rules with the provider. If synchronized
lyrics are a separate entitlement, obtain that entitlement too. If the terms
require additional presentation/reporting work, make those changes *before*
activating the endpoint.

Configure Cloudflare Worker `tipun` production secrets/variables (do not put
secrets into Git or the web page):

- `MUSIXMATCH_API_KEY`: provider-issued key, secret.
- `MUSIXMATCH_DISPLAY_LICENSED=true`: set **only after** appropriate display
  rights and obligations are confirmed.
- `MUSIXMATCH_SYNC_LICENSED=true`: optional, set **only** when line-synced LRC
  use is specifically covered by the agreement.

Until configured, the page still streams Audius community songs and supports
independently authorized custom lyrics and transcription of the user's own
audio. It reports that the licensed service is unavailable; it does not pretend
lyrics were found. Some songs cannot be matched because Audius uploader names
are not the original singers, or the provider lacks those lyrics. The user can
correct the artist name in the Sing Your Song screen and retry.

## Verification after activation

1. Confirm the contract's display, sync, credit, reporting and territory rules.
2. Add the variables securely to the existing `tipun` Cloudflare Worker.
3. Search a provider-covered original song + artist on `/sing-your-song#audius`.
4. Verify returned words, attribution and (if licensed) LRC timestamps against
   the selected exact recording, including live playback timing offset.
5. Try a missing or restricted song: the page must not invent or show truncated
   demo lyrics.

Do not enable the license flag based only on receipt of an API key.
