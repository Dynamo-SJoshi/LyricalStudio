# Contributing to LyricalStudio

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

## Getting set up

Requires Node.js 20 or later.

```bash
git clone https://github.com/arijit-debug/LyricalStudio-Web.git
cd LyricalStudio-Web
npm install
npm run dev
```

Open http://localhost:3000. You don't need any keys: without them the app runs in guest mode, and search uses youtubei.js. See [`.env.example`](.env.example) for the optional settings (Supabase accounts, the official YouTube Data API, rate limiting).

## Good first contributions

- **A new lyric layout.** Templates live in [`src/templates/`](src/templates), one per file. Copy a simple one (such as `Slide.tsx`), register it in `index.ts`, and `chooseTemplate()` can start picking it.
- **Fixes for songs whose lyrics are mistimed or don't show.** Include the artist and title in the issue or PR.
- Issues labelled [`good first issue`](https://github.com/arijit-debug/LyricalStudio-Web/labels/good%20first%20issue).

## Workflow

1. Fork the repo and create a branch: `feat/<short-name>` or `fix/<short-name>`.
2. Make your change. Keep each PR to one feature or fix.
3. Run `npm run lint` and `npm run build`. CI runs both on every PR.
4. If you touched a lyric layout or template, run the fit check: with `npm run dev` running, open http://localhost:3000/dev/fit and expect **0 failures**.
5. Open a pull request into `main` and fill in the template. Add a screenshot or short recording for anything visual.

## Ground rules

These keep the app legal and smooth. PRs that break them can't be merged.

**Playback and data**

- Playback goes through the official YouTube IFrame Player only. The player must stay visible and uncovered (at least 200×200 px). Never hide or overlay it.
- Never download, rip, proxy or host audio (no yt-dlp, no stream extraction).
- Don't spoof headers or work around bot checks to reach a lyrics source.
- No secrets in the repo. Keys go in `.env.local`, and every new variable is documented in `.env.example`.

**Lyrics motion and rendering**

- Lyrics are live DOM text. Animate only `transform` and `opacity` (or the individual `rotate`/`scale` properties) through the Web Animations API helpers in [`src/templates/waapi.ts`](src/templates/waapi.ts). Don't drive motion from JS frame loops, and never animate CSS blur.
- Respect `prefers-reduced-motion`.
- Don't continuously scale text (it rasterizes and looks soft), and don't clip words with `overflow: hidden` wrappers.
- Every word element carries `data-fit` and sits inside a `FitBox`, so lyrics never get cut off.
- When the next line starts, the previous line must disappear completely (no echoes or faint previews).
- The lyric stage uses container units (`cqw`/`cqh`), not `vw`/`vh`.

**Background and CSS**

- Background visuals live in one WebGL shader ([`AmbientBackground.tsx`](src/components/stage/AmbientBackground.tsx)). Don't add DOM shapes, blend modes, filters or `backdrop-filter` behind or over the lyrics.
- No `color-mix()` in CSS (the build lowers it to opaque colors). Compute colors in JS instead.
- Set `backdrop-filter` as an inline style, since the CSS build drops the unprefixed property.

**Fonts**

- Use the system stack with Inter / Noto Sans JP / Noto Sans Devanagari fallbacks. Never bundle SF Pro.

[`AGENTS.md`](AGENTS.md) has the full list of project conventions and the reasons behind them.

## Reporting bugs

Use the bug report template, and include the song (artist and title), your browser and OS, and what you saw. For security problems, see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
