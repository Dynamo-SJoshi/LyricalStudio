"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import type { Track } from "@/lib/types";

const LOCAL_KEY = "ls:likes";

function readLocal(): Track[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as Track[];
  } catch {
    return [];
  }
}

/** Liked songs, saved in this browser. */
function useLikesState() {
  const [likes, setLikes] = useState<Track[]>([]);

  useEffect(() => {
    // reading localStorage must happen after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLikes(readLocal());
  }, []);

  const isLiked = useCallback((t: Track | null) => !!t && likes.some((l) => sameSong(l, t)), [likes]);

  const toggleLike = useCallback(
    (t: Track) => {
      const liked = likes.some((l) => sameSong(l, t));
      const next = liked ? likes.filter((l) => !sameSong(l, t)) : [t, ...likes];
      setLikes(next);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    },
    [likes],
  );

  return { likes, isLiked, toggleLike };
}

const sameSong = (a: Track, b: Track) => a.videoId === b.videoId;

type LikesValue = ReturnType<typeof useLikesState>;
const LikesContext = createContext<LikesValue | null>(null);

export function LikesProvider({ children }: { children: React.ReactNode }) {
  return createElement(LikesContext.Provider, { value: useLikesState() }, children);
}

export function useLikes() {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error("useLikes must be used inside <LikesProvider>");
  return ctx;
}
