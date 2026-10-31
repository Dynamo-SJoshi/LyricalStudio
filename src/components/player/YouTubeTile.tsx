"use client";

import { usePlayer } from "./PlayerProvider";

/**
 * YouTube's API policy requires the player to stay visible, uncovered and at least
 * 200x200 px, so this is as small as it can legally get. Nothing is drawn on top of it.
 */
export function YouTubeTile() {
  const { attachHost, current, error } = usePlayer();

  return (
    <div className={`flex flex-col items-end gap-2 transition-opacity ${current ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      <div
        ref={attachHost}
        className="size-[200px] overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10"
        title="Playing via YouTube"
      />
      {error && <p className="w-[200px] text-[11px] text-[var(--system-red)]">{error}</p>}
    </div>
  );
}
