# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The project rules shared with other agents live in AGENTS.md (imported below). They cover product decisions, layout, and the many rendering/motion conventions. Read them before changing anything; this file only adds what AGENTS.md doesn't say.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server on :3000 (Turbopack)
npm run lint     # eslint (flat config, eslint-config-next)
npm run build    # production build; also the type check
npm start        # serve the production build
```

- There is no unit-test runner. CI (`.github/workflows/ci.yml`) runs `npm ci`, lint and build on every PR and push to main.
- The layout "test" is the fit harness: with `npm run dev` running, open `/dev/fit` (returns 404 in production). It renders every line of 10 songs in every template at several sizes and reports words that would be cut off. To run it headlessly, wait for `window.__fit.done` and read `window.__fit.failures`; expect 0. A full run takes several minutes.
- Known dev-only issue: Turbopack sometimes logs `Module not found: '@vercel/turbopack-next/internal/font/google/font'` for Noto Sans JP. Production builds aren't affected. If `/dev/fit` returns 500, stop the dev server, delete `.next/dev`, and restart.

## How a song becomes moving lyrics

1. **Playback**: `PlayerProvider` (src/components/player) owns the single YouTube IFrame player, the queue and a `PlaybackClock` (src/lib/clock). `getTime()` returns smoothed time that is safe to call every frame.
2. **Data**: `useTrackData(track)` (src/lib/lyrics/useTrackData.ts) fetches `/api/lyrics` and `/api/meta` in parallel. It extracts the album palette through `/api/image` (a same-origin proxy so canvas can read the pixels). It turns LRC into `LyricLine[]` with `buildLines(parseLrc(raw))`; plain lyrics go through `buildUnsyncedLines`, which estimates timing. Words without word-level timestamps get estimated timings scaled to the song's measured pace.
3. **Stage**: `LyricsStage` runs a rAF loop that only *reads* `getTime()` (plus a 0.15 s lead and the per-song sync offset). It picks the current line and how many words are revealed, and calls `setState` only when that changes. Motion itself is never driven from this loop.
4. **Templates**: `chooseScene(line, seed, genre)` (src/templates/index.ts) picks a template and tilt per line from word count, words-per-second, genre and chorus repeats. A user-forced style overrides it. Each template animates words through the WAAPI helpers in src/templates/waapi.ts.
5. **Background**: `AmbientBackground` (one WebGL shader) gets the palette, plus word-landing positions for ripples.

## Server side

- API routes in src/app/api are all read-only GETs: search, radio, home, playlist (YouTube), lyrics (LRCLIB/lrcmux), meta (iTunes), image (artwork proxy with host allowlist, redirect re-checks, raster-only types, 2 MB cap).
- `src/lib/search/index.ts` picks the search backend: the official YouTube Data API when `YOUTUBE_API_KEY` is set (cached, with a per-visitor daily budget of real API calls), otherwise youtubei.js. `YOUTUBEI_ENABLED=false` disables youtubei.js entirely (no home feed or playlists). Routes pass `clientIp(request.headers)` for the budget.
- `src/proxy.ts` (Next 16's replacement for middleware) applies per-IP per-minute limits on `/api/*`. Counters come from `src/lib/rate-limit.ts`: Upstash Redis REST if configured, otherwise per-instance memory. Use `hit(name, windowSec)` for new limits.
- Security headers are set in `next.config.ts`. Config headers override route headers, so `/api/image`'s sandbox CSP is defined there too.
- All env vars are optional and documented in `.env.example`. The production deployment sets none.

## Repo and deployment facts

- Hosted on Vercel (Hobby) at https://lyricalstudio.vercel.app. Every merge to `main` deploys automatically, and Vercel builds a preview for each PR. Vercel Web Analytics is enabled (`<Analytics />` in src/app/layout.tsx; the privacy page describes it).
- GitHub: push only to `origin` (arijit-debug/LyricalStudio). Commit with the author email already set in this repo's git config, not a personal address; GitHub blocks pushes that expose a private email.
- Work on a branch and open a PR (`gh pr create`); the owner merges.
- When changing what the app stores or which services it contacts, update `src/app/privacy/page.tsx` (and its `UPDATED` date) and the README.
