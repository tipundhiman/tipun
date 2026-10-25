# RhymeOrbit Android preview

This is the Trusted Web Activity project generated from the canonical live PWA at `https://rhymeorbit.in` with Bubblewrap 1.27.0. The provisional Android application ID is `in.rhymeorbit.app` (confirm before submitting a Play Console listing).

The GitHub Actions workflow `Android App Bundle (unsigned preview)` builds an **unsigned** release `.aab` for technical validation. This file is **not ready for Google Play upload**. A production upload key must be securely generated, backed up outside Git, and used to sign the bundle. Never commit signing passwords, keystores, or Play Console service credentials.

For fullscreen Trusted Web Activity mode, deploy `/.well-known/assetlinks.json` on the production domain with the package ID and certificate fingerprint from the final Play App Signing certificate. Until verified, the app can show a browser toolbar.

Test microphone recording, playback, login flows, download behavior and all third-party media on an actual Android phone before trial distribution. All content and APIs are served by the live website; Internet access is required for most features.
