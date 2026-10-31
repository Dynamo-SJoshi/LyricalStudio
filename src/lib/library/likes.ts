"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import type { Track } from "@/lib/types";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

const LOCAL_KEY = "ls:likes";

function readLocal(): Track[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as Track[];
  } catch {
    return [];
  }
}

/** Liked songs: stored in Supabase when signed in, in this browser otherwise. */
function useLikesState() {
  const { user } = useAuth();
  const [likes, setLikes] = useState<Track[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();
    if (user && supabase) {
      supabase
        .from("likes")
        .select("track")
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          if (!cancelled && data) setLikes(data.map((r) => r.track as Track));
        });
    } else {
      // reading localStorage must happen after mount
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLikes(readLocal());
    }
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isLiked = useCallback((t: Track | null) => !!t && likes.some((l) => sameSong(l, t)), [likes]);

  const toggleLike = useCallback(
    async (t: Track) => {
      const liked = likes.some((l) => sameSong(l, t));
      const next = liked ? likes.filter((l) => !sameSong(l, t)) : [t, ...likes];
      setLikes(next);
      const supabase = getSupabase();
      if (user && supabase) {
        const res = liked
          ? await supabase.from("likes").delete().eq("user_id", user.id).eq("video_id", t.videoId)
          : await supabase.from("likes").insert({ user_id: user.id, video_id: t.videoId, track: t });
        if (res.error) setLikes(likes); // roll back on failure
      } else {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      }
    },
    [likes, user],
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
