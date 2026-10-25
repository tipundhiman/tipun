# RhymeOrbit — Google Play Store listing draft

Status: draft for internal/closed testing. Do not publish the store listing until the feature checks and policy questionnaire have been completed using the actual app behavior.

## Main store listing (English)

- App name: `RhymeOrbit`
- Category: `Music & Audio` (confirm in Play Console)
- Developer name: use the verified Play Console account's public developer name, not an invented business entity.
- Website: `https://rhymeorbit.in/`
- Privacy policy: `https://rhymeorbit.in/privacy`
- Support contact: `dtipun@gmail.com`

### Short description (maximum 80 characters)

Discover music, write lyrics, sing along and connect with creators.

### Full description (maximum 4,000 characters)

RhymeOrbit brings music discovery and creativity together in one place.

Listen & Chill
Explore tracks from connected music catalogs and discover videos where available. Availability varies by artist, provider, region and rights.

Sing Your Song
Choose supported songs, practice with editable lyrics and record your own vocals. Playback, lyric timing and microphone behavior depend on the source and device.

Write and create
Develop original lyrics, shayari and music ideas in the creator tools. AI-powered features are available when supported by the configured provider and may have limits.

Community
Discover creator posts and share your own work with other music lovers.

Make RhymeOrbit your space for listening, practicing and creating. Some features require an internet connection and an account. Music availability and functionality can vary by source. Respect the rights of artists and other creators when recording, uploading or sharing content.

## Required listing assets

- App icon: existing `public/icons/icon-512.png` (verify Play Console crop and contrast).
- Feature graphic: `docs/play-store/feature-graphic.png` (1024 x 500 PNG). Review legibility in Play Console preview.
- Phone screenshots: capture real app screens from a physical Android device or Android emulator. Suggested screens: home, Listen & Chill, Sing Your Song, creator tools, Community. Screenshots must reflect what a user can actually do.
- Do not use generated or mocked screenshots that misrepresent the actual app interface.

## Final release blockers

1. Identity and contact phone verification in Play Console.
2. Confirm the final Android package ID `in.rhymeorbit.app` before first upload. A Play app package ID cannot be casually changed after publication.
3. Securely generate and back up a private upload signing key, and build a signed release bundle.
4. Enroll in Play App Signing and deploy `/.well-known/assetlinks.json` using the appropriate Play app-signing certificate SHA-256 fingerprint. Test fullscreen Trusted Web Activity behavior.
5. Verify functioning user account deletion both in-app and through a discoverable web link before answering the Data safety deletion questions.
6. Complete Play Data safety, app content, permissions, content rating, privacy and target audience questionnaires based on tested behavior. Do not guess responses.
7. Verify ownership/licensing and third-party media display/recording conditions; test all major functions on Android.
8. Confirm a compliant commercial hosting plan, if applicable, before any commercial release.
9. New personal Play developer accounts generally need closed testing with 12 testers opted in continuously for 14 days before applying for production access, subject to current Play Console requirements.

## References

- Play store listing: https://support.google.com/googleplay/android-developer/answer/9859152
- Listing graphics: https://support.google.com/googleplay/android-developer/answer/9866151
- User account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Play App Signing: https://support.google.com/googleplay/android-developer/answer/9842756
- Testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
