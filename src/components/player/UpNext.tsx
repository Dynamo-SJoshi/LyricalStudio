"use client";

import { usePlayer } from "./PlayerProvider";

export function UpNext() {
  const { queue, index, playQueue } = usePlayer();
  const upcoming = queue.slice(index + 1, index + 30);
  if (index < 0) return null;

  return (
    <div className="glass flex min-h-0 flex-1 flex-col rounded-3xl p-2">
      <h3 className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-secondary uppercase">Up next</h3>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {upcoming.length === 0 && <p className="px-3 py-2 text-sm text-secondary">Nothing queued. Search to add more.</p>}
        {upcoming.map((t, k) => (
          <button
            key={`${t.videoId}-${k}`}
            onClick={() => playQueue(queue, index + 1 + k)}
            className="flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-colors hover:bg-white/10"
          >
            {t.artwork ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.artwork} alt="" referrerPolicy="no-referrer" className="size-9 shrink-0 rounded-md object-cover" loading="lazy" />
            ) : (
              <div className="size-9 shrink-0 rounded-md bg-white/10" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{t.title}</p>
              <p className="truncate text-[12px] text-secondary">{t.artist}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
