"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { PlaybackClock } from "@/lib/clock/playback-clock";
import { isUnplayableError, loadYouTubeApi, YTState, type YTPlayer } from "@/lib/youtube/iframe-api";
import { pushRecent } from "@/lib/library/recent";

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
  next: () => void;
  prev: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  /** smoothed playback position in seconds (call every frame) */
  getTime: () => number;
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

  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const clock = useRef(new PlaybackClock());
  const triedRef = useRef<Set<string>>(new Set());
  const stateRef = useRef({ queue, index });
  useEffect(() => {
    stateRef.current = { queue, index };
  }, [queue, index]);

  const current = index >= 0 ? queue[index] ?? null : null;

  const load = useCallback((videoId: string) => {
    clock.current.reset(0);
    setDuration(0);
    setStatus("loading");
    setError(null);
    if (readyRef.current && playerRef.current) playerRef.current.loadVideoById(videoId);
    else pendingRef.current = videoId;
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
      load(q[i].videoId);
      pushRecent(q[i]);
    },
    [load],
  );

  const playQueue = useCallback(
    (tracks: Track[], startIndex = 0) => {
      stateRef.current = { queue: tracks, index: startIndex };
      setQueue(tracks);
      goTo(startIndex);
    },
    [goTo],
  );

  const next = useCallback(() => goTo(stateRef.current.index + 1), [goTo]);
  const prev = useCallback(() => {
    const p = playerRef.current;
    if (p && p.getCurrentTime() > 3) p.seekTo(0, true);
    else goTo(Math.max(0, stateRef.current.index - 1));
  }, [goTo]);

  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    if (p.getPlayerState() === YTState.PLAYING) p.pauseVideo();
    else p.playVideo();
  }, []);

  const seek = useCallback((s: number) => {
    playerRef.current?.seekTo(Math.max(0, s), true);
    clock.current.reset(Math.max(0, s));
  }, []);

  const setVolume = useCallback((v: number) => {
    const vol = Math.round(Math.min(100, Math.max(0, v)));
    setVolumeState(vol);
    playerRef.current?.setVolume(vol);
    localStorage.setItem("ls:volume", String(vol));
  }, []);

  const getTime = useCallback(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return 0;
    return clock.current.sample(p.getCurrentTime() || 0);
  }, []);

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
      load(alt.videoId);
    } catch {
      giveUp();
    }
  }, [goTo, load]);

  // the YouTube player's callbacks are created once, so they read the latest handlers via refs
  const tryAlternateRef = useRef(tryAlternate);
  const nextRef = useRef(next);
  useEffect(() => {
    tryAlternateRef.current = tryAlternate;
    nextRef.current = next;
  }, [tryAlternate, next]);

  const attachHost = useCallback((host: HTMLDivElement | null) => {
    if (!host || playerRef.current) return;
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
                  setDuration(p.getDuration());
                  break;
                case YTState.PAUSED:
                  setStatus("paused");
                  break;
                case YTState.BUFFERING:
                  setStatus("buffering");
                  break;
                case YTState.ENDED:
                  setStatus("ended");
                  nextRef.current();
                  break;
              }
            },
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

  useEffect(() => () => playerRef.current?.destroy(), []);

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
      next,
      prev,
      toggle,
      seek,
      setVolume,
      getTime,
      attachHost,
    }),
    [queue, index, current, status, duration, volume, error, playQueue, next, prev, toggle, seek, setVolume, getTime, attachHost],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
