"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { PlaybackClock } from "@/lib/clock/playback-clock";
import { isUnplayableError, loadYouTubeApi, YTState, type CaptionTrack, type YTPlayer } from "@/lib/youtube/iframe-api";
import { pushRecent } from "@/lib/library/recent";

/** YouTube's own captions, shown inside the video: "none" = this video has none. */
export type CaptionsState = "off" | "on" | "none";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "buffering" | "ended" | "error";

type PlayerContextValue = {
  queue: Track[];
  index: number;
  current: Track | null;
  status: PlayerStatus;
  duration: number;
  volume: number;
  error: string | null;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  /** play a song, then fill "Up next" with related songs (YouTube Music radio) */
  playRadio: (track: Track) => void;
  next: () => void;
  prev: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  /** smoothed playback position in seconds (call every frame) */
  getTime: () => number;
  captions: CaptionsState;
  /** turn YouTube's captions on or off in the video (kept across songs until turned off) */
  setCaptions: (on: boolean) => void;
  /** called by the visible YouTube tile to host the player */
  attachHost: (el: HTMLDivElement | null) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

const MAX_ALTERNATES = 3;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [error, setError] = useState<string | null>(null);
  const [captions, setCaptionsState] = useState<CaptionsState>("off");
  const captionsWanted = useRef(false);
  /** captions were already applied to the current video */
  const captionsApplied = useRef(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const clock = useRef(new PlaybackClock());
  const triedRef = useRef<Set<string>>(new Set());
  /**
   * While switching songs, the IFrame player keeps reporting the previous video's
   * position (and an ad may play first). Until the new song is confirmed playing,
   * the app shows 0:00 instead of trusting those numbers.
   */
  const switchRef = useRef<{ id: string; stale: number; hint?: number; since: number } | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef({ queue, index });
  useEffect(() => {
    stateRef.current = { queue, index };
  }, [queue, index]);

  const current = index >= 0 ? queue[index] ?? null : null;

  /** The player, but only once its API is actually usable (the object exists before onReady). */
  const api = useCallback((): YTPlayer | null => {
    const p = playerRef.current;
    return p && readyRef.current && typeof p.getCurrentTime === "function" ? p : null;
  }, []);

  /**
   * Apply the captions choice to the player. Captions are a player module: once it has
   * loaded (onApiChange), pick a track, or report that the video has none.
   */
  const pickRef = useRef<(p: YTPlayer) => void>(() => {});
  const applyCaptions = useCallback((p: YTPlayer) => {
    try {
      if (captionsWanted.current) {
        p.loadModule?.("captions");
        // videos without captions may never report the module: check the track list anyway
        setTimeout(() => pickRef.current(p), 3000);
      } else p.unloadModule?.("captions");
      captionsApplied.current = true;
    } catch {
      // the player isn't ready for modules yet; the next PLAYING event retries
    }
  }, []);

  const pickCaptionTrack = useCallback((p: YTPlayer) => {
    if (!captionsWanted.current) return;
    let tracks: CaptionTrack[] = [];
    try {
      tracks = (p.getOption?.("captions", "tracklist") as CaptionTrack[] | undefined) ?? [];
    } catch {
      return;
    }
    if (!tracks.length) {
      // auto-generated captions often aren't in the list but are already showing
      let showing: CaptionTrack | undefined;
      try {
        showing = p.getOption?.("captions", "track") as CaptionTrack | undefined;
      } catch {}
      setCaptionsState(showing?.languageCode ? "on" : "none");
      return;
    }
    // prefer the reader's language, then English, then whatever the video has
    const lang = (navigator.language || "en").slice(0, 2).toLowerCase();
    const pick =
      tracks.find((t) => t.languageCode?.toLowerCase().startsWith(lang) && t.kind !== "asr") ??
      tracks.find((t) => t.languageCode?.toLowerCase().startsWith(lang)) ??
      tracks.find((t) => t.languageCode?.toLowerCase().startsWith("en")) ??
      tracks[0];
    try {
      p.setOption?.("captions", "track", { languageCode: pick.languageCode });
    } catch {}
    setCaptionsState("on");
  }, []);

  useEffect(() => {
    pickRef.current = pickCaptionTrack;
  }, [pickCaptionTrack]);

  const setCaptions = useCallback(
    (on: boolean) => {
      captionsWanted.current = on;
      setCaptionsState(on ? "on" : "off");
      const p = api();
      if (p) applyCaptions(p);
    },
    [api, applyCaptions],
  );

  const load = useCallback(
    (videoId: string, durationHint?: number) => {
      clock.current.reset(0);
      setDuration(0);
      setStatus("loading");
      setError(null);
      captionsApplied.current = false;
      if (captionsWanted.current) setCaptionsState("on");
      const p = api();
      switchRef.current = { id: videoId, stale: p ? p.getCurrentTime() || 0 : 0, hint: durationHint, since: performance.now() };
      if (p) p.loadVideoById(videoId, 0);
      else pendingRef.current = videoId;
      // if the new song hasn't started after a few seconds, nudge it
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      watchdogRef.current = setTimeout(() => {
        const q = api();
        if (!q || switchRef.current?.id !== videoId) return;
        const s = q.getPlayerState();
        if (s === YTState.UNSTARTED || s === YTState.CUED || s === YTState.ENDED) q.playVideo();
      }, 5000);
    },
    [api],
  );

  /** True once the player is really playing the new song (not the old one, not an ad). */
  const confirmSwitch = useCallback((p: YTPlayer) => {
    const sw = switchRef.current;
    if (!sw) return true;
    if (p.getPlayerState() !== YTState.PLAYING) return false;
    const elapsed = performance.now() - sw.since;
    const d = p.getDuration();
    const t = p.getCurrentTime() || 0;
    if (elapsed < 12000) {
      // still showing the previous video, or still reporting its position
      const data = p.getVideoData?.();
      if (data?.video_id && data.video_id !== sw.id) return false;
      if (sw.stale > 5 && t > 5 && t > sw.stale - 2) return false;
    }
    // a very different length means an ad is playing before the song
    // (after 25 s of playback, trust it anyway: some uploads differ in length)
    if (sw.hint && d && Math.abs(d - sw.hint) > 8 && elapsed < 25000) return false;
    switchRef.current = null;
    clock.current.reset(t);
    setDuration(d);
    return true;
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const { queue: q } = stateRef.current;
      if (i < 0 || i >= q.length) {
        setStatus("ended");
        return;
      }
      triedRef.current = new Set([q[i].videoId]);
      stateRef.current = { queue: q, index: i };
      setIndex(i);
      // album uploads have a known length; music videos may not match it
      load(q[i].videoId, q[i].kind === "song" ? q[i].durationSec : undefined);
      pushRecent(q[i]);
    },
    [load],
  );

  /** Append related songs to the queue (no duplicates). */
  const extendWithRadio = useCallback(async (seed: Track) => {
    try {
      const res = await fetch(`/api/radio?id=${encodeURIComponent(seed.videoId)}&artist=${encodeURIComponent(seed.artist)}`);
      const { tracks } = (await res.json()) as { tracks?: Track[] };
      if (!tracks?.length) return false;
      const { queue: q, index: i } = stateRef.current;
      const have = new Set(q.map((t) => t.videoId));
      const extra = tracks.filter((t) => !have.has(t.videoId));
      if (!extra.length) return false;
      const nextQueue = [...q, ...extra];
      stateRef.current = { queue: nextQueue, index: i };
      setQueue(nextQueue);
      return true;
    } catch {
      return false;
    }
  }, []);

  const playQueue = useCallback(
    (tracks: Track[], startIndex = 0) => {
      stateRef.current = { queue: tracks, index: startIndex };
      setQueue(tracks);
      goTo(startIndex);
    },
    [goTo],
  );

  const playRadio = useCallback(
    (track: Track) => {
      playQueue([track], 0);
      void extendWithRadio(track);
    },
    [playQueue, extendWithRadio],
  );

  // at the end of the queue, keep the music going with related songs
  const next = useCallback(async () => {
    const { queue: q, index: i } = stateRef.current;
    if (i + 1 >= q.length && q[i]) await extendWithRadio(q[i]);
    goTo(stateRef.current.index + 1);
  }, [goTo, extendWithRadio]);
  const prev = useCallback(() => {
    const p = api();
    if (p && p.getCurrentTime() > 3) p.seekTo(0, true);
    else goTo(Math.max(0, stateRef.current.index - 1));
  }, [goTo, api]);

  const toggle = useCallback(() => {
    const p = api();
    if (!p) return;
    if (p.getPlayerState() === YTState.PLAYING) p.pauseVideo();
    else p.playVideo();
  }, [api]);

  const seek = useCallback((s: number) => {
    api()?.seekTo(Math.max(0, s), true);
    clock.current.reset(Math.max(0, s));
  }, [api]);

  const setVolume = useCallback((v: number) => {
    const vol = Math.round(Math.min(100, Math.max(0, v)));
    setVolumeState(vol);
    api()?.setVolume(vol);
    localStorage.setItem("ls:volume", String(vol));
  }, [api]);

  const getTime = useCallback(() => {
    const p = api();
    if (!p || !confirmSwitch(p)) return 0;
    return clock.current.sample(p.getCurrentTime() || 0);
  }, [api, confirmSwitch]);

  /** The embed was refused (e.g. label disallows embedding): try another upload of the same song. */
  const tryAlternate = useCallback(async () => {
    const { queue: q, index: i } = stateRef.current;
    const track = q[i];
    if (!track) return;
    const giveUp = () => {
      setStatus("error");
      setError("This song can't be played in embedded players. Skipping…");
      setTimeout(() => {
        if (stateRef.current.index === i) goTo(i + 1);
      }, 1800);
    };
    if (triedRef.current.size > MAX_ALTERNATES) return giveUp();
    try {
      const res = await fetch(`/api/search?type=video&q=${encodeURIComponent(`${track.artist} ${track.title}`)}`);
      const { tracks } = (await res.json()) as { tracks?: Track[] };
      if (stateRef.current.index !== i) return; // user moved on meanwhile
      const alt = tracks?.find((t) => !triedRef.current.has(t.videoId));
      if (!alt) return giveUp();
      triedRef.current.add(alt.videoId);
      // keep the album metadata (better lyric matching), swap only the video
      const patched = { ...track, videoId: alt.videoId, kind: alt.kind };
      const nextQueue = stateRef.current.queue.map((t, k) => (k === i ? patched : t));
      stateRef.current = { queue: nextQueue, index: i };
      setQueue(nextQueue);
      load(alt.videoId); // music video: its length may differ, so no duration check
    } catch {
      giveUp();
    }
  }, [goTo, load]);

  // the YouTube player's callbacks are created once, so they read the latest handlers via refs
  const tryAlternateRef = useRef(tryAlternate);
  const nextRef = useRef(next);
  const applyCaptionsRef = useRef(applyCaptions);
  const pickCaptionTrackRef = useRef(pickCaptionTrack);
  useEffect(() => {
    tryAlternateRef.current = tryAlternate;
    nextRef.current = next;
    applyCaptionsRef.current = applyCaptions;
    pickCaptionTrackRef.current = pickCaptionTrack;
  }, [tryAlternate, next, applyCaptions, pickCaptionTrack]);

  // Exactly one player, ever. The host is recorded synchronously: React may attach the
  // same element twice (dev Strict Mode) before YouTube's script has loaded, which used
  // to create two players, with the app sometimes controlling the wrong one.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const attachHost = useCallback((host: HTMLDivElement | null) => {
    if (!host || hostRef.current) return;
    hostRef.current = host;
    const mount = document.createElement("div");
    host.appendChild(mount);
    loadYouTubeApi()
      .then((YT) => {
        playerRef.current = new YT.Player(mount, {
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            rel: 0,
            fs: 0,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              readyRef.current = true;
              // development only: lets automated tests inspect the player
              if (process.env.NODE_ENV !== "production") (window as unknown as { __ytPlayer?: YTPlayer }).__ytPlayer = e.target;
              const saved = Number(localStorage.getItem("ls:volume"));
              const vol = Number.isFinite(saved) && saved > 0 ? saved : 80;
              e.target.setVolume(vol);
              setVolumeState(vol);
              if (pendingRef.current) {
                e.target.loadVideoById(pendingRef.current);
                pendingRef.current = null;
              }
            },
            onStateChange: (e) => {
              const p = e.target;
              clock.current.playing = e.data === YTState.PLAYING;
              switch (e.data) {
                case YTState.PLAYING:
                  setStatus("playing");
                  // a new video starts without the captions module
                  if (captionsWanted.current && !captionsApplied.current) applyCaptionsRef.current(p);
                  if (!switchRef.current) setDuration(p.getDuration());
                  break;
                case YTState.PAUSED:
                  setStatus("paused");
                  break;
                case YTState.BUFFERING:
                  setStatus("buffering");
                  break;
                case YTState.ENDED:
                  setStatus("ended");
                  // advance outside the player's own event (loading inside it can stall)
                  setTimeout(() => void nextRef.current(), 200);
                  break;
              }
            },
            onApiChange: (e) => pickCaptionTrackRef.current(e.target),
            onError: (e) => {
              if (isUnplayableError(e.data)) void tryAlternateRef.current();
              else {
                setStatus("error");
                setError("Playback failed. Try another song.");
              }
            },
          },
        });
      })
      .catch((err: Error) => {
        setStatus("error");
        setError(err.message);
      });
  }, []);

  // The player lives for the whole session (no destroy on unmount: a dev Strict Mode
  // remount would otherwise leave the app without a player).

  // OS media keys / lock screen controls
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album ?? "",
      artwork: current.artwork ? [{ src: current.artwork, sizes: "544x544" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    navigator.mediaSession.setActionHandler("nexttrack", next);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
  }, [current, toggle, next, prev]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      index,
      current,
      status,
      duration,
      volume,
      error,
      playQueue,
      playRadio,
      next,
      prev,
      toggle,
      seek,
      setVolume,
      getTime,
      captions,
      setCaptions,
      attachHost,
    }),
    [queue, index, current, status, duration, volume, error, playQueue, playRadio, next, prev, toggle, seek, setVolume, getTime, captions, setCaptions, attachHost],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
