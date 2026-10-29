# RhymeOrbit — Google Play readiness and family safety audit (29 Oct 2026)

**Scope:** Cloudflare-hosted website `rhymeorbit.in` and the Android Trusted Web Activity package `in.rhymeorbit.app` pointing to `https://rhymeorbit.in/`. This is an engineering/policy checklist, **not** an assertion of compliance, certification or approval. Review latest Play Console disclosures before every submission.

## Changes implemented in the repository

- **Deletion request:** `public/delete-account.html` gives an accessible external email-request path, also linked in the logged-in Profile, footer and Privacy Policy. It prepares an email draft; sending it is required. **It does not automatically delete accounts or transmit an internal support ticket.** Test a complete verified deletion manually before release.
- **Neutral age choice:** `public/age-check.html` asks for age band only, without collecting birthday. Initial website/TWA entry and sensitive standalone generator pages check local storage. This is **not verified age assurance** and can be bypassed by technical users. It must **not** be the sole eligibility or consent control for child accounts.
- **Under-13 Kids Studio:** `public/kids.html` has a **device-only nickname, avatar choice and lyric notebook**, with no online login/profile, public sharing, strangers' chat, Vibe Match, upload, recording, AI requests or paid features. Its storage is local to browser/app; no cloud synchronization. This is a restricted pilot experience, not a production child-account program.
- **Teen safeguard:** the UI blocks Vibe Match navigation for the 13–17 selection. Because this is client-side only, do **not** treat it as a reliable server-side minor-access control for user-to-user communication.
- **Safety policy:** `public/child-safety.html` publishes anti-CSAE/CSAM standards, reporting contact and family feature restrictions.
- **In-app reporting:** authenticated reports can be submitted from the main Help screen and Riya panel; `public/integration.js` writes to `public.safety_reports` with RLS INSERT restricted to the logged-in reporter. Admins need to regularly review and resolve queued reports. Reporting from all other standalone content screens requires verification.
- **Privacy and terms** updated to describe deletion, local Kids Studio and current limitations.

## Outstanding release blockers and tests (do not skip)

1. **Account deletion end-to-end:** verify registered-email request, verification, associated Supabase data deletion, public posts, generated songs, conversations, Cloudflare R2 object keys, other providers, and any lawful retention exceptions. Auth `admin.deleteUser` is a **server-only** operation and will cascade related Postgres rows; it **does not automatically delete R2 files** or revoke all already-issued JWT access tokens until expiry. Never expose service credentials in a website or mobile app. Establish support response/process and test with disposable user and media.
2. **Under-13 real accounts are OFF:** before activating online child profiles, build **verified parental consent where legally required**, account-holder age controls, server-enforced minor permissions, guardian-management and deletion rights, and comply with privacy laws for all served regions. Review third-party SDK/provider permission for child data and disable inappropriate content on all deep links. Do not select under-13 audience in Play Console as fully supported based only on the restricted on-device Kids preview.
3. **Social/chat/dating:** Vibe Match and stranger messaging require further review under Age-Restricted Content & Functionality. Enforce any applicable age restrictions **server-side**, not solely through self-declared local storage. Consider blocking public interactions until age is trusted. Existing creator messaging tables and policies require a privacy/security check.
4. **UGC:** verify always-on report and block buttons on every public post, comments, profile and private message; moderation queue, removal escalation, repeated abuser handling, filter restricted content, no sexual content discoverable to minors, documented user terms and moderation staffing.
5. **AI output:** verify Riya, lyrics, songs, videos and other generation surfaces offer offensive-content reporting **within the app** (not merely mailto/external browser), policy filtering, abuse handling, and controls against sexual abuse exploitation or deceptive content.
6. **Families compliance:** test the child path on Android with a clean install and direct/deep links; ensure no child-unsafe content, Google fonts or other third-party SDK/data transmission before age selection; no location, ad identifier, unapproved ads/SDK, microphone, camera or stranger contacts on child routes. Verify age-unknown mode. Test neutral age choice is not encouraging false age declarations. Children-related consent and disclosures depend on locale.
7. **Play Console:** complete and accurately cross-check Data safety (email, identity, phone, uploaded media, chats, voice, storage, API/provider sharing, transit encryption, deletion), Content Rating, Target Audience, App Access, privacy, ads, permissions and category. Do not claim 'No data' or 'all encrypted' without tested evidence.
8. **Digital subscriptions:** Play-distributed digital feature purchases generally require Google Play Billing except permitted programs/exemptions. Current checkout appears disabled; **do not enable Razorpay digital checkout from the Play-distributed app** until applicable billing program requirements are verified.
9. **Android TWA:** current package `in.rhymeorbit.app` starts at `/`; website changes can surface in the installed app without a new native binary, **after the live deployment updates**. Verify app links/assetlinks certificate, web permissions, Store Listing, tested signed release, and Play's update/review requirements.
10. **Authentication:** test credential recovery, OAuth & OTP, login/logouts, unverified email behavior and accessible support. Supabase security advisor on 29 Oct reported 'Leaked Password Protection Disabled' and SECURITY DEFINER functions `public.can_message` and `public.can_read_conversation` callable by signed-in users; audit the function bodies and remediate only with regression tests.
11. **Child-safety operations:** designate a real child-safety point of contact in Play Console, actively review reports, remove CSAM when discovered, cooperate with legal obligations, and maintain a meaningful escalation process. A policy webpage alone does not complete these obligations.
12. **Pre-release tests:** clean browser, Chrome on desktop, Samsung Fold 4, TWA/internal-test build, with signed-out and authenticated users; verify delete URL response 200, actual mail send, local Kids profile deletion, report submission success, age selection paths, dark/light screens, responsive layout, screen readers, and no regression to music playback.

## Manual account deletion runbook (until secure automation is reviewed)

1. Accept the deletion email or in-app request and verify account ownership without requesting password/OTP. A verified request is distinct from an email-draft opening.
2. Check active paid subscriptions/legal retention before deletion and disclose any exceptions transparently.
3. Enumerate account-owned media paths from `creator_media.storage_path`, `community_posts.media_path`, `generated_songs.storage_path` and any additional R2/third-party records. Preserve object references **before** deleting database rows.
4. Delete associated R2 media, posts, projects, saved generations and provider records, taking care with shared conversations and legally required safety records. Record failures and retry; do not claim completion if any storage remains.
5. Delete the verified Supabase Auth user using a trusted server/admin context with service-role credentials. Check cascading foreign keys and downstream auth providers. Sign out and invalidate credentials as applicable. Recheck access after token expiry.
6. Notify the requester through the verified communication channel when complete, including limited retention reasons where applicable.

## Official sources reviewed

- Google Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Families: https://support.google.com/googleplay/android-developer/answer/9893335
- Target Audience: https://support.google.com/googleplay/android-developer/answer/9867159
- Child Safety Standards: https://support.google.com/googleplay/android-developer/answer/14747720
- Age-restricted features: https://support.google.com/googleplay/android-developer/answer/16302250
- UGC policy: https://support.google.com/googleplay/android-developer/answer/9876937
- AI content policy: https://support.google.com/googleplay/android-developer/answer/13985936
- Billing: https://support.google.com/googleplay/android-developer/answer/9858738
- Supabase user deletion: https://supabase.com/docs/guides/auth/managing-user-data

**Current verdict:** New safety/deletion interfaces are committed to GitHub. Do not assert production deployment or Google Play compliance until the actual live URL, end-to-end reporting/deletion workflows, moderation operations and age-appropriate protections have been tested.
