# OMJ — O Meri Jaan

An independent React, TypeScript, GSAP, SVG and Canvas musical application.

## Delivery & Verification Status

- **Installation:** Executed and locked with strict dependency tree.
- **Typecheck:** PASSED (0 errors via `npm run typecheck`).
- **Unit Tests:** PASSED (12 of 12 tests passed via `npm run test`).
- **Production Build:** PASSED (Vite production bundle compiled to `dist/`).
- **Local Dev Server:** Active on `http://127.0.0.1:4179/`.
- **Remote Synchronization:** Synced to `https://github.com/HassaanFisky/OMJ` on branch `feat/omj-living-storybook-reconstruction`.
- **Note on Browser Tests:** Automated browser tests run against headless Chromium/WebKit. Simulated WebKit viewport tests are not physical iPhone hardware tests.

## Independence

This project does not connect to another application, repository, database,
authentication system or deployment.

Create a new directory, a new repository and a new deployment project.

## Requirements

Use a supported Node version accepted by package.json.
Node 24 is a suitable choice for this package set.

## Install

```bash
npm install
```

Commit the generated package-lock.json after dependency review.

## Development

```bash
npm run dev
```

Choose the exact authorized audio file and press PLAY OMJ.

A local file is played through an object URL and is not uploaded.

## Public audio asset

Place the recording at:

```text
public/audio/omj.mp3
```

Copy .env.example to .env and set:

```dotenv
VITE_AUDIO_SOURCE=/audio/omj.mp3
```

Audio files are ignored by Git by default. Include them in deployment only
when distribution is authorized.

## Verification

```bash
npm run typecheck
npm run test
npm run build
```

Or:

```bash
npm run check
```

## Browser tests

```bash
npx playwright install chromium webkit
npm run test:browser
```

The browser suite generates a silent diagnostic WAV.

It tests media controls, cue selection, ending state, transcript coverage,
reduced motion and viewport bounds.

It does not verify the actual song's vocal alignment.
WebKit viewport tests are not physical iPhone tests.

## Architecture

- AudioController owns the media element and animation scheduling.
- score.ts contains the supplied lyrics and provisional intervals.
- scenes.ts defines reusable poses and shot choreography.
- FilmEngine samples isolated paused GSAP shot timelines.
- BearRig supplies original reusable SVG anatomy.
- BearAnimations drives joints, two-bone arms, eyes and expressions.
- ParticleEngine draws deterministic weather from media time.
- CinematicStage combines environment, character rigs and lyrics.
- TimingEditor supports manual audio calibration and JSON import/export.

## Synchronization

audio.currentTime is the only musical clock.

There are no scene-timing timeout chains.
The GSAP timelines do not play independently.

Pausing freezes the film.
Seeking reconstructs the film at the selected audio position.
Backgrounding pauses playback; returning does not restart sound.

## Timing review

All initial intervals are provisional.

Use Timing during development:
1. Load the exact final audio file.
2. Mark each phrase start and end.
3. Review both choruses separately.
4. Check instrumental intervals.
5. Verify the final vocal and instrumental ending.
6. Export and review the score.
7. Transfer approved data into src/timeline/score.ts.

Do not certify timing merely because the values contain decimals.

Word-level highlighting requires explicitly verified word intervals.
Changing the audio edit requires timing review again.

## Transcription changes

The supplied words are preserved.

Importing cue data cannot silently replace the canonical transcription.
If listening proves a transcription needs correction, explicitly update
the canonical source and record the change during review.

## Accessibility

- Explicit playback.
- Semantic controls.
- Native seek slider.
- Full transcript.
- Visible keyboard focus.
- Reduced-motion state.
- Browser zoom remains available.
- No flashing effects.

Manual screen-reader, contrast and increased-text testing remains required.

## Security and privacy

- No accounts.
- No geolocation.
- No microphone or camera.
- No analytics.
- No API secrets.
- No dynamic HTML insertion.
- Imported JSON is validated.
- Audio input has file-size/type screening and media-decoder validation.
- No third-party media extraction.

Client-side file screening is not a server-side security boundary.
There is no upload endpoint.

## Deployment

```bash
npm run build
```

Output directory:

```text
dist
```

Deploy only this independent directory.
A Vercel configuration is included.
No backend or database is required.

## Required final manual tests

- Actual audio start, pause, resume, seeking and replay.
- Every lyric onset and ending.
- All repeated chorus lines.
- Thought-cloud readability and imagined waist/kiss staging.
- Assisted standing and sitting.
- Character contact in the kiss, embrace and lap scene.
- Gifts and flowers.
- Outdoor rain/snow clipping.
- Window decorations and final quilt.
- Portrait and landscape.
- 200% text and transcript access.
- Keyboard and screen reader.
- Background interruption.
- Physical-phone frame rate, memory and heat.
- Speaker and Bluetooth synchronization.
- Independent production deployment.

Do not mark these passed until performed.
