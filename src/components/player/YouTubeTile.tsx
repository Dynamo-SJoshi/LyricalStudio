"use client";

import { usePlayer } from "./PlayerProvider";

/**
 * The YouTube player must stay visible and uncovered (YouTube API policy, min 200x200),
 * so it lives in its own tile. Nothing is ever drawn on top of it.
 */
export function YouTubeTile() {
  const { attachHost, current, error } = usePlayer();

  return (
    <div className={`flex flex-col gap-2 transition-opacity ${current ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      <div ref={attachHost} className="h-[200px] w-[356px] overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10" />
      <p className="px-1 text-[11px] text-secondary">{error ?? "Playing via YouTube"}</p>
    </div>
  );
}
