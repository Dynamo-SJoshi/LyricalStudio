# LyricalStudio

An open-source music player for the web that turns lyrics into kinetic typography: bold, word-by-word motion in sync with the song, colored with an Apple-inspired palette drawn from each track's album art.

Inspired by the [Cotodama Lyric Speaker](https://cotodama-speaker.com/). Not affiliated with Cotodama or Apple.

## Features

- Search and play almost any song for free (YouTube Music catalog)
- Time-synced lyrics, word by word where the source has word timings, animated as they're sung
- Seven Cotodama-style text layouts (Stack, Slide, Zoom, Letters, Scatter, Graph, Flow), picked per line from the song's genre, pace and chorus, or chosen by hand
- A Liquid Glass background drawn on the GPU (WebGL): flowing album-colored light under an undulating glass slab, with ripples spreading from each word as it's sung and a wave of light on every new line
- White lyrics with vivid highlights in the album's colors, on randomly chosen words that change every time a song plays
- Smooth motion on the GPU compositor: gliding springs, squash-and-stretch word entrances and trail motion blur; text stays crisp once it settles
- Instrumental breaks show the song's title card; short pauses keep the last line on screen
- Lines always fit on screen, whatever the song, language or window size
- A home screen with suggestions: Quick picks and playlists from YouTube Music, "Made for you" radio, recently played and liked songs
- Up next fills itself with related songs, and keeps going when the queue ends
- Up next and video buttons in the header (pop-up queue, enlargeable video); full-screen mode (F)
- Lyrics for recently played songs are kept in the browser, so they still show if the lyrics service is down
- Press Shift+F for a frame-rate meter
- English, Japanese (日本語) and Hindi (हिन्दी); romanized lines appear as subtitles
- Per-song sync nudge if lyrics run early or late
- Optional login (Google, GitHub or email link) through Supabase

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Ctrl K or / | Search |
| Space | Play / pause |
| Left / Right | Back / forward 5 seconds |
| [ / ] | Lyrics earlier / later by 0.25 s |
| F | Full screen |
| Shift+F | Frame-rate meter |
| Esc | Close search, shrink the video |

## How it works

| Part | Source |
| --- | --- |
| Playback | The official [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) (a small floating mini-player, at least 200×200 as YouTube requires) |
| Song search | The official [YouTube Data API v3](https://developers.google.com/youtube/v3) when `YOUTUBE_API_KEY` is set, otherwise YouTube Music through [youtubei.js](https://github.com/LuanRT/YouTube.js) |
| Artwork and metadata | [iTunes Search API](https://performance-partners.apple.com/search-api) |
| Synced lyrics | [lrcmux](https://lrcmux.dev) (open source; word-synced where available, e.g. Deezer / KuGou), then [LRCLIB](https://lrclib.net) |
| Fallback lyrics (plain, timing estimated) | YouTube Music's licensed lyrics (Musixmatch / LyricFind), then [lyrics.ovh](https://lyricsovh.docs.apiary.io) |
| Login and storage | [Supabase](https://supabase.com) |

LyricalStudio does not download, host or redistribute any audio. All playback goes through YouTube's official embedded player.

## Getting started

Requires Node.js 20 or later.

```bash
git clone https://github.com/arijit-debug/LyricalStudio-Web.git
cd LyricalStudio-Web
npm install
npm run dev
```

Open http://localhost:3000. That's all you need: without Supabase keys the app runs in **guest mode**, and likes are saved in your browser.

### Turning on accounts (optional)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql) to create the likes table.
3. Copy `.env.example` to `.env.local` and fill in the Project URL and anon key (Project Settings → API).
4. Under Authentication → URL Configuration, add `http://localhost:3000` (and your deployed URL) to the redirect URLs.
5. Optionally enable Google and GitHub under Authentication → Providers. Email links work out of the box.
6. Restart `npm run dev`. Everyone must now sign in, and likes sync to their account.

## Deploying your own copy

LyricalStudio is a standard Next.js app, so [Vercel](https://vercel.com) (or any Node.js host) works:

1. Import the repository in Vercel.
2. Add the environment variables from [`.env.example`](.env.example). For a public site, set:
   - `YOUTUBE_API_KEY` and `YOUTUBEI_ENABLED=false`, so search uses the official YouTube Data API. The free quota is about 100 searches a day; results are cached.
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, so the per-IP rate limits on `/api/*` are shared across server instances.
   - The Supabase keys, if you want accounts.
3. In Supabase, add your production URL under Authentication → URL Configuration.
4. Update the contact details on the [privacy page](src/app/privacy/page.tsx) if you host your own copy.

## Contributing

Pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, good first contributions and the ground rules. New lyric animation templates are the easiest place to start (`src/templates/`). After changing a layout, open http://localhost:3000/dev/fit while `npm run dev` is running: it renders every line of ten songs in every layout and reports any word that would be cut off.

Found a security problem? Please report it privately (see [SECURITY.md](SECURITY.md)).

## License

[MIT](LICENSE)
