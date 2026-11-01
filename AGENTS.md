<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LyricalStudio — project rules (shared by Claude Code and Antigravity)

## What this is
Open-source (MIT) web music player whose main feature is Cotodama-style kinetic lyric typography, styled with Apple's design language (system colors, album-art gradients, glass materials, spring motion). Desktop-first.

## Decisions already made (don't revisit without the owner)
- Playback: official YouTube IFrame Player API. YouTube policy requires the player to stay visible and uncovered (min 200x200 px), so show it as a small video tile; never hide or overlay it. Never download, rip, proxy or host audio (no yt-dlp, no stream extraction).
- Search: the official YouTube Data API when YOUTUBE_API_KEY is set, otherwise youtubei.js on the server (prefer "Artist - Topic" album uploads for lyric timing). Metadata/artwork: iTunes Search API. Lyrics: lrcmux and LRCLIB (credit them).
- No accounts: the app is guest-only. Likes, recently played songs and per-song sync offsets live in the browser (localStorage). Don't add login or a database without the owner.
- Languages: English, Japanese, Hindi. Japanese needs word segmentation (Intl.Segmenter), Hindi uses Devanagari fonts.
- Style: bold Cotodama-like typography, Apple system colors + album-art palette. Respect prefers-reduced-motion.
- Fonts: system stack (-apple-system) with Inter / Noto Sans JP / Noto Sans Devanagari fallbacks. Never bundle SF Pro.
- No secrets in the repo: keys live in .env.local; document every key in .env.example.

## Layout
- src/app/api — search (youtubei.js), lyrics (LRCLIB), meta (iTunes genre/artwork), image (artwork proxy for color extraction)
- src/lib/lyrics — LRC parsing, word timing estimates (per-song pace), useTrackData hook
- src/lib/clock — PlaybackClock smooths the IFrame player's coarse time reports
- src/lib/search — search backends: official YouTube Data API (YOUTUBE_API_KEY) or youtubei.js (YOUTUBEI_ENABLED)
- src/lib/youtube, src/lib/theme, src/lib/library
- src/components — AppShell (providers + layout), player, stage, search, MobileNotice
- src/proxy.ts — per-IP rate limits on /api/*
- src/app/privacy — privacy policy and terms
- src/templates — lyric animation templates, one per file; chooseTemplate() in index.ts picks per line

## Conventions
- Layout: Home uses the full width; the lyrics stage keeps clear of the 200x200 floating mini-player (YouTube requires it visible while playing). Up next / video / full-screen live in the header. Scrollbars are hidden globally; rows have arrow buttons.
- Exactly one YouTube player: PlayerProvider.attachHost records the host synchronously (dev Strict Mode attaches twice). After loadVideoById the IFrame API keeps reporting the old video's time (and ads may play): confirmSwitch gates the clock until the new song is really playing.
- Lyrics sources (src/lib/lyrics/sources.ts): lrcmux (api.lrcmux.dev/get?format=lrc, word-synced enhanced LRC when available) → LRCLIB (line-synced) → YouTube Music lyrics (plain) → lyrics.ovh (plain). Japanese per-character word timings are regrouped into phrases in buildLines. Plain lyrics get estimated timing (buildUnsyncedLines) and upgradeLater=true while LRCLIB is down, so the app re-checks every minute. Don't spoof headers or work around bot checks to reach other sources.
- Lyrics: LRCLIB outages return { unavailable: true } with status 503 (never cached); the client retries every 20 s and keeps the last 150 songs' lyrics in localStorage (src/lib/lyrics/cache.ts).
- Lyric stage uses CSS container units (cqw/cqh), not vw/vh, so lyrics never run under the YouTube tile.
- Load external artwork with referrerPolicy="no-referrer" (googleusercontent blocks some referrers).
- Background visuals live in one WebGL shader (src/components/stage/AmbientBackground.tsx); don't add DOM shapes, blend modes, backdrop-filters or filters behind/over the lyrics. Words get cheap text-shadows only.
- Type: white lyrics with vivid highlights (wordColor/vivid). Highlights are random (highlightSet): 1-4 real words per line, reshuffled every play via a per-play seed. Lyrics are live DOM text; no continuous scaling of text (it rasterizes and looks soft). No residue: previous lines must fully disappear when the next one starts (no echoes, no faint previews).
- Smoothness: lyric motion runs on the compositor via the Web Animations API (src/templates/waapi.ts: animateTo, springTiming bakes springs into linear() easing). Animate only transform/opacity (or the individual rotate/scale properties). Don't drive lyric motion from JS frame loops (motion values), and never animate CSS blur. Motion blur = delayed trail copies in KineticWord.
- Don't clip words with overflow-hidden wrappers: it cuts the highlight glow into a visible box.
- No permanent will-change and no 3D transforms at rest on words (rotateX only while flipping): each forces a GPU layer per word.
- Per-line seeds must be unsigned: (a ^ b) >>> 0. A negative seed % 3 indexes past the palette.
- No color-mix() in CSS: the Tailwind/Lightning CSS build "lowers" it to opaque fallbacks. Compute colors in JS (see pastel/lyricShadow in src/templates/shared.ts).
- backdrop-filter must be set as an inline style; the CSS build drops the unprefixed property.
- Lyrics must never be cut off: every word element carries data-fit and sits inside a FitBox (src/templates/FitBox.tsx), which knows the camera's tilt/zoom. After changing any layout, run the fit check: `npm run dev`, open /dev/fit (dev-only page), and expect 0 failures.
- If CSS changes don't show up in `npm run dev`, restart the dev server; its stylesheet watcher can go stale.

## Workflow
- One tool per feature branch; open a PR into main.
- Run `npm run lint` and `npm run build` before committing.
