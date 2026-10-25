# RhymeOrbit Android preview

This is the Trusted Web Activity project generated from the canonical live PWA at `https://rhymeorbit.in` with Bubblewrap 1.27.0. The provisional Android application ID is `in.rhymeorbit.app` (confirm before submitting a Play Console listing).

The GitHub Actions workflow `Android App Bundle (unsigned preview)` builds an **unsigned** release `.aab` for technical validation. This file is **not ready for Google Play upload**. A production upload key must be securely generated, backed up outside Git, and used to sign the bundle. Never commit signing passwords, keystores, or Play Console service credentials.

For fullscreen Trusted Web Activity mode, deploy `/.well-known/assetlinks.json` on the production domain with the package ID and certificate fingerprint from the final Play App Signing certificate. Until verified, the app can show a browser toolbar.

Test microphone recording, playback, login flows, download behavior and all third-party media on an actual Android phone before trial distribution. All content and APIs are served by the live website; Internet access is required for most features.

## Secure signing procedure (after Play Console verification)

1. Confirm that `in.rhymeorbit.app` is the final package ID.
2. Generate an upload keystore locally on a trusted computer with Java `keytool`. Choose a strong password and a unique alias. Do not paste passwords or the keystore into chat, email or the repository.
3. Keep at least two secure offline backups of the keystore and its passwords. Losing an upload key requires a Google Play upload-key reset process.
4. Configure the signed release build on a trusted computer or use securely stored GitHub Actions repository secrets. Do not upload an unsigned bundle to Play Console.
5. After first Play app-signing configuration, obtain the **app signing certificate** fingerprint from Play Console, publish a matching Digital Asset Links statement on the domain, and test on an Android device.

The current generated `android/app/build.gradle` contains no production signing configuration. This is intentional until the user-owned upload key is created.
