"use client";

import { useEffect, useMemo, useState } from "react";
import type { LyricLine, LyricsResult, Track, TrackMeta } from "@/lib/types";
import { buildLines, buildUnsyncedLines, parseLrc } from "@/lib/lyrics/parse";
import { extractPalette, fallbackPalette, hashString, type Palette } from "@/lib/theme/palette";
import { readCachedLyrics, writeCachedLyrics } from "@/lib/lyrics/cache";

export type LyricsStatus = "idle" | "loading" | "synced" | "unsynced" | "instrumental" | "none" | "unavailable";

type Loaded = {
  key: string;
  lyrics: LyricsResult | null;
  meta: TrackMeta;
  /** the lyrics service was unreachable (not the same as "this song has no lyrics") */
  unavailable?: boolean;
};

const cache = new Map<string, Promise<Loaded>>();

const songKey = (t: Track) => `${t.artist}|${t.title}`.toLowerCase();

function load(track: Track): Promise<Loaded> {
  const key = songKey(track);
  let p = cache.get(key);
  if (!p) {
    const q = new URLSearchParams({ title: track.title, artist: track.artist });
    if (track.album) q.set("album", track.album);
    if (track.durationSec) q.set("duration", String(track.durationSec));
    const cached = readCachedLyrics(key);
    p = Promise.all([
      cached
        ? Promise.resolve({ lyrics: cached, unavailable: false })
        : fetch(`/api/lyrics?${q}`)
            .then((r) => r.json())
            .then((d: { lyrics?: LyricsResult | null; unavailable?: boolean }) => {
              if (d.lyrics) writeCachedLyrics(key, d.lyrics);
              return { lyrics: d.lyrics ?? null, unavailable: !!d.unavailable };
            })
            .catch(() => ({ lyrics: null, unavailable: true })),
      fetch(`/api/meta?${q}`)
        .then((r) => r.json())
        .then((d: { meta?: TrackMeta }) => d.meta ?? {})
        .catch(() => ({})),
    ]).then(([l, meta]) => ({ key, lyrics: l.lyrics, unavailable: l.unavailable, meta }));
    // don't cache failures: outages are retried soon, "not found" after a minute
    p.then((v) => !v.lyrics && setTimeout(() => cache.delete(key), v.unavailable ? 0 : 60_000));
    cache.set(key, p);
  }
  return p;
}

export function useTrackData(track: Track | null, playerDuration: number) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [palette, setPalette] = useState<Palette>(() => fallbackPalette(0));

  const key = track ? songKey(track) : "";
  const seed = useMemo(() => hashString(key), [key]);
  // when the lyrics service is down, try again every 20 s while this song plays
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!loaded?.unavailable || loaded.key !== key) return;
    const id = setTimeout(() => setAttempt((a) => a + 1), 20_000);
    return () => clearTimeout(id);
  }, [loaded, key]);

  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    load(track).then((v) => {
      if (cancelled) return;
      setLoaded(v);
      const art = v.meta.artworkHiRes ?? track.artwork;
      const fb = fallbackPalette(hashString(songKey(track)));
      if (!art) setPalette(fb);
      else
        extractPalette(`/api/image?url=${encodeURIComponent(art)}`, hashString(songKey(track))).then(
          (p) => !cancelled && setPalette(p),
        );
    });
    return () => {
      cancelled = true;
    };
    // key captures the identity of the song; track object may be re-created
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const current = loaded && loaded.key === key ? loaded : null;
  const duration = track?.durationSec || playerDuration || 240;

  const { lines, status } = useMemo((): { lines: LyricLine[]; status: LyricsStatus } => {
    if (!track) return { lines: [], status: "idle" };
    if (!current) return { lines: [], status: "loading" };
    const l = current.lyrics;
    if (!l) return { lines: [], status: current.unavailable ? "unavailable" : "none" };
    if (l.instrumental) return { lines: [], status: "instrumental" };
    if (l.synced) return { lines: buildLines(parseLrc(l.raw), duration), status: "synced" };
    return { lines: buildUnsyncedLines(l.raw, duration), status: "unsynced" };
  }, [track, current, duration]);

  return {
    lines,
    status,
    palette,
    seed,
    genre: current?.meta.genre,
    artwork: current?.meta.artworkHiRes ?? track?.artwork,
  };
}
