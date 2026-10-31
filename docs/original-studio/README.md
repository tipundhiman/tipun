# RhymeOrbit Original Studio

Human-created music production module. No generative AI calls in this module.

## Phase 1
- Web drum sequencer and synthesizer using Web Audio API
- Microphone capture with permission, local recording, metronome and playback
- Conventional DSP: biquad EQ, dynamics compressor, gain and delay/reverb
- Local WAV export, original take retention and SHA-256 provenance manifest
- Mobile-responsive UI and Android integration plan

## Phase 2
- Piano roll, multi-track editing, timeline and non-destructive undo
- Project persistence in Supabase, audio blobs in Cloudflare R2 via authenticated uploads
- Export of stems, MIDI and production history
- Native Android low-latency recording and monitoring

## Safety and provenance
- Record actual source type and tool versions; do not assert that a detector or distributor has certified content.
- Never label imported or AI-generated audio as verified human-created without supporting evidence.
- Only use owned or appropriately licensed samples and recordings.
- Raw recordings are private by default; require explicit consent before cloud upload.
- Protect R2 writes with authenticated, short-lived upload URLs and validate file size/type.
- Avoid uploading any raw vocal or private project files in public repositories.

## Integration
Build on this isolated branch; inspect the existing site routing, build and deployment configuration before merging. Keep the existing production music generator and public pages unchanged until the new studio passes recording, playback, mobile, export and security tests.
