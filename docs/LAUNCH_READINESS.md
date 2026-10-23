# RhymeOrbit — launch and compliance readiness

Canonical repository: `tipundhiman/tipun` on `master`. Use the existing Vercel project and domain `rhymeorbit.in`.

## Implemented and validated in source
- Real discover entry points instead of fictional artist and track profiles.
- A single floating **Riya** chat interface using the authenticated `/api/ai` route and in-memory thread context; rendered content uses `textContent` to avoid HTML injection.
- Riya name in server assistant prompt; Riya Grover branding removed.
- Search-engine metadata, WebSite structured data, crawlable features page, canonical URL, sitemap and robots file.
- Dedicated privacy, terms and copyright-reporting pages; public contact email: dtipun@gmail.com.
- Security headers (nosniff, clickjacking protection, referrer and browser permission restrictions).
- No new music-model provider activated without keys and rights validation.

## Blockers before commercial release
1. **Hosting license:** Vercel Hobby is for personal/non-commercial use. Move to an appropriate commercial plan or compliant host before a monetized launch.
2. **Payment:** membership checkout is disabled. Require a tested payment gateway, receipts, refunds, entitlement checks, and clear pricing/consumer disclosures before charging anyone.
3. **AI music rights:** confirm Treblo provider authorization, output license, generation quotas, copyrighted inputs and artist/voice-cloning restrictions.
4. **Creative Commons / YouTube:** preserve exact artist attribution, licenses and embed requirements. Do not assume a music track is commercially cleared without reviewing its license.
5. **Privacy:** obtain legal review of the DPDP Act/Rules disclosures, retention, user rights, data requests and international provider transfers. The provided privacy page is an operational draft, not a legal guarantee.
6. **Moderation:** set up infringement-report workflow, takedown review, appeals, user blocking/report triage and evidence preservation.
7. **Deployment:** verify the actual production SHA and domain routing independently of GitHub CI success.
8. **SEO:** verify the domain in Google Search Console, submit `https://rhymeorbit.in/sitemap.xml`, review index coverage and mobile usability. SEO does not guarantee ranking.
9. **Analytics/SEM:** do not introduce ad pixels, remarketing tags or conversion analytics without appropriate consent and privacy disclosures.

## Candidate text/assistant APIs (not enabled)
- NVIDIA NIM: free developer prototyping access; production/commercial licensing depends on the offering and model terms.
- Cloudflare Workers AI: has a published free daily allowance; model support, latency, region, and terms need validation.
- Gemini API: currently wired in the app; review Free/Paid data use and quotas before scaling.

Do not publish "all features fully live" claims until authenticated live browser and provider testing pass.
