"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePlayer } from "./PlayerProvider";

/**
 * Right-hand icon rail: "Up next" opens the queue as a pop-up panel; "Video" pops
 * the YouTube player out larger. (The player itself always stays on screen: YouTube
 * requires embedded players to remain visible while playing.)
 */
export function SideRail({ videoBig, onToggleVideo }: { videoBig: boolean; onToggleVideo: () => void }) {
  const { queue, index, current } = usePlayer();
  const [queueOpen, setQueueOpen] = useState(false);
  const upcoming = Math.max(0, queue.length - index - 1);

  return (
    <div className="flex items-center gap-2">
      <RailButton
        label="Up next"
        active={queueOpen}
        onClick={() => {
          // the queue never covers the video: shrink it first
          if (!queueOpen && videoBig) onToggleVideo();
          setQueueOpen((v) => !v);
        }}
        badge={upcoming || undefined}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h11M4 12h11M4 18h7" />
          <path d="M18 14v6M15 17h6" />
        </svg>
      </RailButton>
      <RailButton
        label={videoBig ? "Shrink video" : "Enlarge video"}
        active={videoBig}
        onClick={() => {
          setQueueOpen(false);
          onToggleVideo();
        }}
        disabled={!current}
      >
        {videoBig ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 4v5H4M15 20v-5h5M4 9l6-6M20 15l-6 6" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
          </svg>
        )}
      </RailButton>
      <AnimatePresence>{queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}</AnimatePresence>
    </div>
  );
}

function RailButton({
  label,
  onClick,
  active,
  disabled,
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`glass relative flex size-10 items-center justify-center rounded-full transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 active:scale-95 disabled:opacity-35 ${active ? "bg-white/20 ring-2 ring-white/40" : ""}`}
    >
      {children}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-[var(--system-pink)] px-1.5 text-[11px] leading-5 font-semibold tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function QueuePanel({ onClose }: { onClose: () => void }) {
  const { queue, index, playQueue } = usePlayer();
  const ref = useRef<HTMLDivElement>(null);
  const upcoming = queue.slice(index + 1, index + 60);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest('[aria-label="Up next"]')) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className="glass fixed top-[76px] right-[248px] z-40 flex max-h-[min(640px,calc(100vh-220px))] w-[400px] flex-col rounded-[28px] p-2 shadow-2xl"
      style={{ transformOrigin: "top right" }}
      initial={{ opacity: 0, scale: 0.9, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -6, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    >
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <h3 className="text-lg font-bold">Up next</h3>
        <span className="text-xs text-secondary">{upcoming.length} songs</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {upcoming.length === 0 && <p className="px-3 py-3 text-sm text-secondary">Nothing queued yet. Play something and related songs will appear here.</p>}
        {upcoming.map((t, k) => (
          <button
            key={`${t.videoId}-${k}`}
            onClick={() => {
              playQueue(queue, index + 1 + k);
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-colors hover:bg-white/10"
          >
            {t.artwork ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.artwork} alt="" referrerPolicy="no-referrer" className="size-12 shrink-0 rounded-lg object-cover" loading="lazy" />
            ) : (
              <div className="size-12 shrink-0 rounded-lg bg-white/10" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{t.title}</p>
              <p className="truncate text-[13px] text-secondary">{t.artist}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
