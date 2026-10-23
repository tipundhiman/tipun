# RhymeOrbit source-of-truth map

Canonical codebase: `tipundhiman/tipun`, production branch `master`. The existing Vercel project serves `rhymeorbit.in` and its configured aliases. Do not create another project for UI changes.

## Where to make each change

- `public/index.html`: single-page shell, primary navigation, authenticated header, page templates, and the shared **Memberships** navigation entry. Login UI visibility uses `state.user`, populated only from authenticated Supabase sessions.
- `public/integration.js`: Supabase authentication, session-to-`state.user` synchronization, backend-connected projects and AI requests. This is the **single frontend authentication source**. Do not add a second membership-specific login polling loop.
- `public/memberships.js`: one pricing modal, Free/Premium/Pro display, monthly usage query, and quota-upgrade handling. **Do not create another floating Memberships button here.** The header in `index.html` owns that button.
- `api/index.js`: authenticated server API, provider integration, subscription/credit enforcement. Never use frontend UI visibility as authorization.
- `public/creator-kit.js`: beta EPK/creator kit implementation. No floating homepage CTA.
- `public/admin-music-visibility.js`: admin-only recovery controls, backed by server-side admin verification.
- `public/media.js`, `public/social.js`, `public/community-feed.js`: feature extensions. Some wrap core rendering to add behavior; **do not remove wrappers without validating the feature they add**.
- `public/index.html` and `api/index.js`: Riya Grover assistant UI and server AI instructions, respectively.

## Production change checklist

1. Edit only the canonical repository's `master` branch.
2. Check for existing implementations before adding another UI element or renderer.
3. Confirm the latest commit is actually deployed to the existing Vercel production project.
4. Test as guest, normal signed-in user, and admin. Verify login/logout transitions.
5. Validate JS syntax, feature routes, and server-side authorization. Do not claim live verification based on a GitHub commit alone.

## Remaining refactor work

The site still has a large `public/index.html` and intentional feature wrappers in `integration.js`/`media.js`. A full file-by-file deduplication and regression test pass has **not** been completed. Consolidate these incrementally with tests, not bulk deletion.
