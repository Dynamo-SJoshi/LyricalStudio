"use client";

import { usePlayer } from "./PlayerProvider";

/**
 * The YouTube player. YouTube's API policy requires it to stay visible and uncovered
 * (at least 200x200) while playing, so it can grow ("pop out") but never hide.
 * Nothing is ever drawn on top of it.
 */
export function YouTubeTile({ big, onShrink }: { big: boolean; onShrink: () => void }) {
  const { attachHost, current, error } = usePlayer();

  return (
    <div
      className={`fixed right-6 bottom-[120px] z-40 flex flex-col items-end gap-2 transition-opacity ${current ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      {big && (
        <button
          onClick={onShrink}
          className="glass rounded-full px-3 py-1 text-[12px] transition hover:bg-white/15"
          aria-label="Shrink video"
        >
          Shrink video
        </button>
      )}
      <div
        ref={attachHost}
        className="overflow-hidden rounded-2xl bg-black/40 shadow-2xl ring-1 ring-white/10 transition-[width,height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={big ? { width: "min(720px, 58vw)", height: "calc(min(720px, 58vw) * 9 / 16)" } : { width: 200, height: 200 }}
        title="Playing via YouTube"
      />
      {error && <p className="w-[200px] text-[11px] text-[var(--system-red)]">{error}</p>}
    </div>
  );
}
