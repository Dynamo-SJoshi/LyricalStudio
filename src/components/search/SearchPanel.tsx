"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Track } from "@/lib/types";
import { usePlayer } from "@/components/player/PlayerProvider";
import { useLikes } from "@/lib/library/likes";
import { readRecent } from "@/lib/library/recent";
import { formatTime } from "@/lib/format";

/** Spotlight-style search field with results, likes and recently played. */
export function SearchPanel() {
  const { playQueue, playRadio, playNext, current } = usePlayer();
  const { likes } = useLikes();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Track[]>([]);
  const [recent, setRecent] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K / "/" focuses search; Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  // debounced search
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        const data = (await res.json()) as { tracks?: Track[]; error?: string };
        if (data.error) setError(data.error);
        setResults(data.tracks ?? []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError("Search failed. Check your connection.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const playOne = (track: Track) => {
    playRadio(track);
    setOpen(false);
    inputRef.current?.blur();
  };

  const play = (list: Track[], i: number) => {
    playQueue(list, i);
    setOpen(false);
    inputRef.current?.blur();
  };

  const showResults = query.trim().length > 0;

  return (
    <div ref={boxRef} className="relative w-[min(560px,46vw)]">
      <label className="glass flex h-11 items-center gap-3 rounded-full px-4 transition-shadow focus-within:shadow-[0_0_0_3px_rgba(10,132,255,0.45)]">
        <SearchIcon />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setRecent(readRecent());
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length) playOne(results[0]);
          }}
          placeholder="Search songs, artists…"
          aria-label="Search songs"
          className="h-full flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-secondary"
        />
        <kbd className="hidden rounded-md border border-white/15 px-1.5 py-0.5 text-[11px] text-secondary sm:block">Ctrl K</kbd>
      </label>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="glass absolute top-13 right-0 left-0 z-40 max-h-[62vh] overflow-y-auto rounded-3xl p-2 shadow-2xl"
          >
            {showResults ? (
              <Section title={loading ? "Searching…" : "Songs"}>
                {error && <p className="px-3 py-2 text-sm text-[var(--system-red)]">{error}</p>}
                {!loading && !error && results.length === 0 && <Empty>No songs found.</Empty>}
                {results.map((t) => (
                  // a searched song plays with a radio of related songs after it
                  <Row
                    key={t.videoId}
                    track={t}
                    onClick={() => playOne(t)}
                    onPlayNext={() => playNext(t)}
                    active={current?.videoId === t.videoId}
                  />
                ))}
              </Section>
            ) : (
              <>
                <Section title="Liked songs">
                  {likes.length === 0 && <Empty>Tap the heart while a song plays to save it here.</Empty>}
                  {likes.slice(0, 8).map((t, i) => (
                    <Row
                      key={t.videoId}
                      track={t}
                      onClick={() => play(likes, i)}
                      onPlayNext={() => playNext(t)}
                      active={current?.videoId === t.videoId}
                    />
                  ))}
                </Section>
                {recent.length > 0 && (
                  <Section title="Recently played">
                    {recent.slice(0, 8).map((t, i) => (
                      <Row
                        key={t.videoId}
                        track={t}
                        onClick={() => play(recent, i)}
                        onPlayNext={() => playNext(t)}
                        active={current?.videoId === t.videoId}
                      />
                    ))}
                  </Section>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-1">
      <h3 className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-secondary uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-2 text-sm text-secondary">{children}</p>;
}

function Row({
  track,
  onClick,
  onPlayNext,
  active,
}: {
  track: Track;
  onClick: () => void;
  onPlayNext?: () => void;
  active: boolean;
}) {
  return (
    <div
      className={`group flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-white/10 ${
        active ? "bg-white/10" : ""
      }`}
    >
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {track.artwork ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.artwork} alt="" referrerPolicy="no-referrer" className="size-11 shrink-0 rounded-lg object-cover" loading="lazy" />
        ) : (
          <div className="size-11 shrink-0 rounded-lg bg-white/10" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{track.title}</p>
          <p className="truncate text-[13px] text-secondary">
            {track.artist}
            {track.album ? ` · ${track.album}` : ""}
          </p>
        </div>
        {track.durationSec ? <span className="text-[13px] text-secondary tabular-nums">{formatTime(track.durationSec)}</span> : null}
      </button>
      {onPlayNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayNext();
          }}
          title="Play next"
          aria-label={`Play ${track.title} next`}
          className="glass hidden size-8 shrink-0 items-center justify-center rounded-full text-secondary opacity-0 transition group-hover:opacity-100 hover:text-foreground md:flex"
        >
          <PlayNextIcon />
        </button>
      )}
    </div>
  );
}

function PlayNextIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m11 5 7 7-7 7" />
      <path d="M4 4v16" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-secondary" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
