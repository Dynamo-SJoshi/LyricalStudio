"use client";

import { usePlayer } from "./PlayerProvider";

/**
 * The YouTube player. YouTube's API policy requires it to stay visible and uncovered
 * (at least 200x200) while playing, so it can grow ("pop out") but never hide.
 * Nothing is ever drawn on top of it.
 *
 * lowered: the control bar is hidden (immersive mode), so the tile glides down into the
 * space the bar leaves (it stays fully visible; only its position changes).
 */
export function YouTubeTile({ big, onShrink, lowered = false }: { big: boolean; onShrink: () => void; lowered?: boolean }) {
  const { attachHost, current, error } = usePlayer();

  return (
    <div
      className={`fixed right-6 bottom-[112px] z-40 flex flex-col items-end gap-2 transition-[opacity,translate] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${current ? "opacity-100" : "pointer-events-none opacity-0"}`}
      // 112px - 92px = 20px from the bottom, the control bar's own margin
      style={{ translate: lowered ? "0 92px" : "0 0" }}
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
      {/* glass frame around the player (the frame never overlaps the video itself) */}
      <div className="glass rounded-[26px] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div
          ref={attachHost}
          className="overflow-hidden rounded-[20px] bg-black transition-[width,height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={big ? { width: "min(720px, 58vw)", height: "calc(min(720px, 58vw) * 9 / 16)" } : { width: 200, height: 200 }}
          title="Playing via YouTube"
        />
      </div>
      {error && <p className="w-[200px] text-[11px] text-[var(--system-red)]">{error}</p>}
    </div>
  );
}
