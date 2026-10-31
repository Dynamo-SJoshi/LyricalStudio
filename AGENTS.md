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
- Search: youtubei.js on the server (prefer "Artist - Topic" album uploads for lyric timing). Metadata/artwork: iTunes Search API. Lyrics: LRCLIB (credit it).
- Auth + data: Supabase (login required; likes, playlists, per-song sync offsets).
- Languages: English, Japanese, Hindi. Japanese needs word segmentation (Intl.Segmenter), Hindi uses Devanagari fonts.
- Style: bold Cotodama-like typography, Apple system colors + album-art palette. Respect prefers-reduced-motion.
- Fonts: system stack (-apple-system) with Inter / Noto Sans JP / Noto Sans Devanagari fallbacks. Never bundle SF Pro.
- No secrets in the repo: keys live in .env.local; document every key in .env.example.

## Layout
- src/app/api — search (youtubei.js), lyrics (LRCLIB), meta (iTunes genre/artwork), image (artwork proxy for color extraction)
- src/lib/lyrics — LRC parsing, word timing estimates (per-song pace), useTrackData hook
- src/lib/clock — PlaybackClock smooths the IFrame player's coarse time reports
- src/lib/youtube, src/lib/theme, src/lib/library, src/lib/supabase
- src/components — AppShell (providers + login gate + layout), player, stage, search, auth
- src/templates — lyric animation templates, one per file; chooseTemplate() in index.ts picks per line
- supabase/schema.sql — likes table with row level security

## Conventions
- Lyric stage uses CSS container units (cqw/cqh), not vw/vh, so lyrics never run under the YouTube tile.
- Auth is client-side only (Supabase browser client). Without keys the app runs in guest mode.
- Load external artwork with referrerPolicy="no-referrer" (googleusercontent blocks some referrers).
- Avoid animating CSS blur on big or many elements (it stutters). For motion blur use KineticWord / blurFor() in src/templates/kinetic.tsx.
- Per-line seeds must be unsigned: (a ^ b) >>> 0. A negative seed % 3 indexes past the palette.

## Workflow
- One tool per feature branch; open a PR into main.
- Run `npm run lint` and `npm run build` before committing.
