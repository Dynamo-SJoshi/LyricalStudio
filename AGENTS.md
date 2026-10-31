<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LyricalStudio — project rules (shared by Claude Code and Antigravity)

## What this is
Open-source (MIT) web music player whose main feature is Cotodama-style kinetic lyric typography, styled with Apple's design language (system colors, album-art gradients, glass materials, spring motion). Desktop-first.

## Decisions already made (don't revisit without the owner)
- Playback: official YouTube IFrame Player API, player hidden, audio only. Never download, rip, proxy or host audio (no yt-dlp, no stream extraction).
- Search: youtubei.js on the server (prefer "Artist - Topic" album uploads for lyric timing). Metadata/artwork: iTunes Search API. Lyrics: LRCLIB (credit it).
- Auth + data: Supabase (login required; likes, playlists, per-song sync offsets).
- Languages: English, Japanese, Hindi. Japanese needs word segmentation (Intl.Segmenter), Hindi uses Devanagari fonts.
- Style: bold Cotodama-like typography, Apple system colors + album-art palette. Respect prefers-reduced-motion.
- Fonts: system stack (-apple-system) with Inter / Noto Sans JP / Noto Sans Devanagari fallbacks. Never bundle SF Pro.
- No secrets in the repo: keys live in .env.local; document every key in .env.example.

## Layout
- src/app — routes (Next.js 16 App Router)
- src/lib — non-UI logic (search, lyrics, sync clock)
- src/components — UI
- src/templates — lyric animation templates, one per file

## Workflow
- One tool per feature branch; open a PR into main.
- Run `npm run lint` and `npm run build` before committing.
