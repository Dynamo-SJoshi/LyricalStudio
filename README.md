# LyricalStudio

An open-source music player for the web that turns lyrics into kinetic typography: bold, word-by-word motion in sync with the song, colored with an Apple-inspired palette drawn from each track's album art.

Inspired by the [Cotodama Lyric Speaker](https://cotodama-speaker.com/). Not affiliated with Cotodama or Apple.

## Features

- Search and play almost any song for free (YouTube Music catalog)
- Lyrics synced to playback and animated word by word
- Nine Cotodama-style text layouts (Stack, Slide, Burst, Zoom, Letters, Scatter, Graph, Flow, Vertical), picked per line from the song's genre, pace and chorus, or chosen by hand
- Moving shapes around the words: network lines, outline shapes, stripes, color blocks, rings and particles that burst on every word, plus bars, diamonds and panels that invert the text they cross
- Tilted lines, a slow camera push-in, the previous line's last words lingering in color, and directional motion blur on fast-moving words
- Colors and a moving background taken from each song's album art, glass controls, spring motion
- English, Japanese (日本語) and Hindi (हिन्दी); romanized lines appear as subtitles
- Per-song sync nudge if lyrics run early or late
- Liked songs, recently played, and an up-next queue
- Optional login (Google, GitHub or email link) through Supabase

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Ctrl K or / | Search |
| Space | Play / pause |
| Left / Right | Back / forward 5 seconds |
| [ / ] | Lyrics earlier / later by 0.25 s |
| Esc | Close search |

## How it works

| Part | Source |
| --- | --- |
| Playback | The official [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) (shown as a small video tile, as YouTube requires) |
| Song search | YouTube Music, through [youtubei.js](https://github.com/LuanRT/YouTube.js) |
| Artwork and metadata | [iTunes Search API](https://performance-partners.apple.com/search-api) |
| Synced lyrics | [LRCLIB](https://lrclib.net) |
| Login and storage | [Supabase](https://supabase.com) |

LyricalStudio does not download, host or redistribute any audio. All playback goes through YouTube's official embedded player.

## Getting started

Requires Node.js 20 or later.

```bash
git clone https://github.com/<your-username>/LyricalStudio-Web.git
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

## Contributing

Pull requests are welcome. New lyric animation templates are the easiest place to start; see `CONTRIBUTING.md` (coming soon).

## License

[MIT](LICENSE)
