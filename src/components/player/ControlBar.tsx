"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "./PlayerProvider";
import { useLikes } from "@/lib/library/likes";
import { formatTime } from "@/lib/format";
import { TEMPLATES, type TemplateChoice } from "@/templates";

type Props = {
  offset: number;
  onOffset: (v: number) => void;
  template: TemplateChoice;
  onTemplate: (t: TemplateChoice) => void;
};

/** Floating glass control bar: track info, transport, progress, sync offset, style, volume. */
export function ControlBar({ offset, onOffset, template, onTemplate }: Props) {
  const { current, status, duration, volume, toggle, next, prev, seek, setVolume, getTime, queue, index, loop, toggleLoop } = usePlayer();
  const { isLiked, toggleLike } = useLikes();
  const [time, setTime] = useState(0);
  // a drag on the progress bar in progress (null = showing the real position)
  const [scrub, setScrub] = useState<number | null>(null);
  const scrubRef = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTime(getTime()), 250);
    return () => clearInterval(id);
  }, [getTime]);

  const pointerDown = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitScrub = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const v = scrubRef.current;
    if (v === null) return;
    scrubRef.current = null;
    setScrub(null);
    seek(v);
  }, [seek]);

  const startScrub = (v: number) => {
    scrubRef.current = v;
    setScrub(v);
    // safety net: a scrub with no button held (keyboard, stray events) finishes by itself
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => !pointerDown.current && commitScrub(), 1500);
  };

  // Finish a drag wherever the button is released. Deferred one tick: the slider sends a
  // last change event after the release, which used to start a phantom scrub that froze
  // the bar at the old position (even across songs).
  useEffect(() => {
    const up = () => {
      if (!pointerDown.current) return;
      pointerDown.current = false;
      setTimeout(commitScrub, 0);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", up);
    };
  }, [commitScrub]);

  // a new song starts at 0: drop any unfinished drag and the old position
  useEffect(() => {
    scrubRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScrub(null);
    setTime(0);
  }, [current?.videoId]);

  if (!current) return null;
  const playing = status === "playing" || status === "buffering";
  const shown = scrub ?? time;
  const total = duration || current.durationSec || 0;
  const liked = isLiked(current);

  return (
    <div className="glass flex h-[76px] w-full items-center gap-5 rounded-[28px] px-4 shadow-2xl">
      {/* track */}
      <div className="flex w-[260px] min-w-0 items-center gap-3">
        {current.artwork && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.artwork} alt="" referrerPolicy="no-referrer" className="size-12 rounded-xl object-cover shadow-lg" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{current.title}</p>
          <p className="truncate text-[13px] text-secondary">{current.artist}</p>
        </div>
        <IconButton label={liked ? "Remove from liked songs" : "Like"} onClick={() => toggleLike(current)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? "var(--system-pink)" : "none"} stroke={liked ? "var(--system-pink)" : "currentColor"} strokeWidth="2">
            <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.2 0 3.6 1.2 5.2 3 1.6-1.8 3-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21Z" strokeLinejoin="round" />
          </svg>
        </IconButton>
      </div>

      {/* transport */}
      <div className="flex items-center gap-1">
        <IconButton label="Previous" onClick={prev}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
        </IconButton>
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex size-12 items-center justify-center rounded-full bg-foreground text-black transition-transform active:scale-90"
        >
          {playing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
          )}
        </button>
        <IconButton label="Next" onClick={next} disabled={index >= queue.length - 1}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
        </IconButton>
        <button
          onClick={toggleLoop}
          className={`flex size-9 items-center justify-center rounded-full transition ${
            loop ? "bg-[var(--system-pink)] text-white shadow-sm" : "text-secondary hover:bg-white/10 hover:text-foreground"
          }`}
          title={loop ? "Looping current song (press L to disable)" : "Loop current song (press L)"}
          aria-label={loop ? "Disable repeat" : "Repeat current song"}
        >
          <RepeatIcon />
        </button>
      </div>

      {/* progress */}
      <div className="flex min-w-0 flex-1 items-center gap-3 text-[12px] text-secondary tabular-nums">
        <span className="w-10 text-right">{formatTime(shown)}</span>
        <input
          type="range"
          min={0}
          max={total || 1}
          step={0.1}
          value={Math.min(shown, total || 1)}
          onPointerDown={() => (pointerDown.current = true)}
          onChange={(e) => startScrub(Number(e.target.value))}
          onKeyUp={commitScrub}
          aria-label="Seek"
          className="range w-full min-w-0 flex-1"
          style={{ "--fill": `${total ? (shown / total) * 100 : 0}%` } as React.CSSProperties}
        />
        <span className="w-10">{formatTime(total)}</span>
      </div>

      {/* sync offset */}
      <div className="flex items-center gap-1 text-[12px]" title="If lyrics run early or late, nudge them. Saved per song. Keys: [ and ]">
        <IconButton label="Lyrics earlier" onClick={() => onOffset(offset - 0.25)} small>
          −
        </IconButton>
        <span className="w-14 text-center text-secondary tabular-nums">
          {offset === 0 ? "Sync" : `${offset > 0 ? "+" : ""}${offset.toFixed(2)}s`}
        </span>
        <IconButton label="Lyrics later" onClick={() => onOffset(offset + 0.25)} small>
          +
        </IconButton>
      </div>

      {/* style */}
      <select
        value={template}
        onChange={(e) => onTemplate(e.target.value as TemplateChoice)}
        aria-label="Lyric style"
        className="h-8 rounded-full border border-white/15 bg-white/5 px-3 text-[13px] outline-none"
      >
        <option value="auto">Auto style</option>
        {Object.entries(TEMPLATES).map(([id, t]) => (
          <option key={id} value={id}>
            {t.name}
          </option>
        ))}
      </select>

      {/* volume */}
      <div className="flex w-[120px] shrink-0 items-center gap-2 pr-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-secondary"><path d="M4 9h4l5-4v14l-5-4H4z" /></svg>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="range w-full min-w-0 flex-1"
          style={{ "--fill": `${volume}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
  small,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`flex items-center justify-center rounded-full text-foreground transition hover:bg-white/10 active:scale-90 disabled:opacity-30 ${small ? "size-7 text-lg" : "size-10"}`}
    >
      {children}
    </button>
  );
}

function RepeatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
