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
  /** plain lyrics shown while LRCLIB is down: check again for synced ones */
  upgradeLater?: boolean;
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
    q.set("videoId", track.videoId);
    const cached = readCachedLyrics(key);
    p = Promise.all([
      cached
        ? Promise.resolve({ lyrics: cached, unavailable: false })
        : fetch(`/api/lyrics?${q}`)
            .then((r) => r.json())
            .then((d: { lyrics?: LyricsResult | null; unavailable?: boolean; upgradeLater?: boolean }) => {
              // keep only synced lyrics offline: plain ones may be upgraded later
              if (d.lyrics?.synced || d.lyrics?.instrumental) writeCachedLyrics(key, d.lyrics);
              return { lyrics: d.lyrics ?? null, unavailable: !!d.unavailable, upgradeLater: !!d.upgradeLater };
            })
            .catch(() => ({ lyrics: null, unavailable: true, upgradeLater: false })),
      fetch(`/api/meta?${q}`)
        .then((r) => r.json())
        .then((d: { meta?: TrackMeta }) => d.meta ?? {})
        .catch(() => ({})),
    ]).then(([l, meta]) => ({ key, lyrics: l.lyrics, unavailable: l.unavailable, upgradeLater: "upgradeLater" in l ? l.upgradeLater : false, meta }));
    // don't cache failures or stand-ins: outages/upgrades are retried soon, "not found" after a minute
    p.then((v) => (!v.lyrics || v.upgradeLater) && setTimeout(() => cache.delete(key), v.unavailable || v.upgradeLater ? 0 : 60_000));
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
    if (!loaded || loaded.key !== key || !(loaded.unavailable || loaded.upgradeLater)) return;
    // no lyrics at all: retry soon; plain stand-in lyrics: look for synced ones each minute
    const id = setTimeout(() => setAttempt((a) => a + 1), loaded.unavailable ? 20_000 : 60_000);
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
    lyricsCredit: current?.lyrics?.credit,
    artwork: current?.meta.artworkHiRes ?? track?.artwork,
  };
}
