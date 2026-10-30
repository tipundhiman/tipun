# RhymeOrbit Creator Lab — 20 free international creator tools

Live route: https://rhymeorbit.in/creator-lab
Tech: vanilla HTML/CSS/ES Modules on existing Cloudflare Worker tipun. No new API contracts, payments, database tables, hosting projects or vendor accounts.

## What is implemented

| # | Working tool | How it works |
|---|---|---|
| 1 | Hook spark generator | Static songwriting prompts in English, Hindi, Spanish, Portuguese, French and Urdu, with 4 moods |
| 2 | Song structure planner | Custom sections/bars, 4/4 timeline at chosen BPM |
| 3 | Rhyme pocket | Small local English near-rhyme bank (clearly limited) |
| 4 | Unicode word counter | Word, line and character counts; browser-local draft |
| 5 | English syllable guide | Approximate line-level syllables, not professional phonetics |
| 6 | Repetition finder | Repeated lyric line analyzer |
| 7 | Lyric delivery timer | Approximate spoken duration at user WPM |
| 8 | Timed LRC exporter | Validate mm:ss.xx timestamps and export a usable LRC file |
| 9 | Tap BPM | Last up-to-eight taps and interval median |
| 10 | Metronome | User-activated Web Audio clicks, stops on page leave |
| 11 | Key transposer | Chromatic major/minor keys ±12 semitones |
| 12 | Scale finder | Major/natural minor notes (simplified enharmonic spelling) |
| 13 | Chord progression builder | Diatonic 4-chord patterns by root/mode |
| 14 | Note-to-frequency | MIDI note → note name and frequency |
| 15 | Bar-time estimator | Bars/BPM → 4/4 song duration |
| 16 | Private voice memo | Browser mic permission, 30s maximum, playback and browser-dependent download codec |
| 17 | Metadata brief | Artist/title/language/genre/credits to copyable release brief |
| 18 | Split checker | Ownership percentages, duplicate detection, total 100% test |
| 19 | UTM link builder | HTTPS campaign links with encoded source and campaign |
| 20 | Release checklist | Seven checkable launch tasks stored locally |

## Code organization

- public/creator-lab.html: exactly 20 accessible cards, grouped into three sections.
- public/creator-lab.css: responsive light premium interface, keyboard focus, reduced motion.
- public/creator-lab-core.js: deterministic exported utilities; change math/validation here first.
- public/creator-lab.js: browser DOM/events/recording. No fetch calls, third-party scripts or uploads.
- public/_headers: microphone permission only for the Creator Lab path (subject to browser prompts).
- tests/creator-lab.test.js: source and functional unit tests for helpers, sound math, international text, links and limits.
- Root index, features, site navigation, mobile feature sheet, feature finder and sitemap link to the same page.
- scripts/production-smoke.mjs: public delivery check after deployment.

## Full-song provider economics (not Creator Lab costs)

The separate paid music backend currently submits **one** Treblo v3 song per request to `https://api.treblo.com/v1/generations/v3`. Treblo's developer docs say one v3 generation costs **100 provider credits** and produces **one song**; failed tasks are not charged by the provider. The current [Treblo API pricing page](https://treblo.com/developers/pricing) lists Starter $11/month for 20,000 provider credits (~200 songs) and pay-as-you-go $0.06/100 credits. These prices can change; **do not promise users these are RhymeOrbit retail rates**.

RhymeOrbit exposes a **separate** 100 Orbit Credits per successful song/accounting reservation mapping. Provider balance, cash payment, plan entitlement and Orbit Credits are **not interchangeable**, and a billing screen cannot activate paid rights without Google Play purchase verification. Treblo's [API pricing](https://treblo.com/developers/pricing) also requires user-facing attribution; do not silently remove the existing "Powered by Treblo" credit without confirming provider API terms.

## Cost and safety

The 20 tools use browser CPU and local storage, not the paid AI song provider. They are separate from full-vocal AI song generation, which still consumes RhymeOrbit music quotas. No voice recording is uploaded to server; users should download before closing the tab. Lyrics draft and the release checklist remain in this browser only; clearing local storage removes them.

English rhymes use a small offline dictionary. English syllables are rough estimates. Non-English word counts use Intl.Segmenter where available. These are helpful writing utilities, not professional music mastering, automatic translation, legal distribution, guaranteed audience growth or a full DAW.

Age gate sends under-13 visitors to restricted Kids Studio but is not formal proof of age. Respect privacy, moderation, copyrights, rights agreements and platform policies.

## Maintenance and release

1. Run npm test in the repository (Node >=20) and require passing GitHub Actions checks.
2. Update creator-lab-core.js and its tests before adding/changing a formula. Keep HTML, JS and tests aligned.
3. Check the existing Cloudflare tipun production deployment receives the commit and 100% traffic; never create a duplicate.
4. Run npm run audit:live externally. The Android Digital Asset Links App Signing certificate is a separate known blocker.
5. Manually test Chrome Android, Safari iOS and desktop; test mic permissions, LRC export and tap/metronome audio. CI is not a substitute.
6. Never infer that Play subscriptions are ready or enable real charges from a successful Creator Lab test.

International adoption remains a product hypothesis; measure retention and user value after launch.
