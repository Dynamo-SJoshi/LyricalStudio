# LyricalStudio

An open-source music player for the web that turns lyrics into kinetic typography: bold, word-by-word motion in sync with the song, colored with an Apple-inspired palette drawn from each track's album art.

Inspired by the [Cotodama Lyric Speaker](https://cotodama-speaker.com/). Not affiliated with Cotodama or Apple.

## Features (planned)

- Search and play almost any song for free
- Lyrics synced to playback, animated word by word
- Multiple motion templates chosen by the song's genre and pace
- Album-art color themes, glass materials and smooth spring motion
- English, Japanese (日本語) and Hindi (हिन्दी) lyrics
- Login to save likes and playlists

## How it works

| Part | Source |
| --- | --- |
| Playback | The official [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) (hidden player, audio only) |
| Song search | YouTube Music, through [youtubei.js](https://github.com/LuanRT/YouTube.js) |
| Artwork and metadata | [iTunes Search API](https://performance-partners.apple.com/search-api) |
| Synced lyrics | [LRCLIB](https://lrclib.net) |
| Login and storage | [Supabase](https://supabase.com) |

LyricalStudio does not download, host or redistribute any audio. All playback goes through YouTube's official embedded player.

## Getting started

Requires Node.js 20 or later.

```bash
git clone https://github.com/<your-username>/LyricalStudio.git
cd LyricalStudio
npm install
cp .env.example .env.local   # then fill in your Supabase keys
npm run dev
```

Open http://localhost:3000.

## Contributing

Pull requests are welcome. New lyric animation templates are the easiest place to start; see `CONTRIBUTING.md` (coming soon).

## License

[MIT](LICENSE)
