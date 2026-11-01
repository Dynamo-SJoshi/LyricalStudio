"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { Track } from "@/lib/types";
import { usePlayer } from "@/components/player/PlayerProvider";
import { useLikes } from "@/lib/library/likes";
import { readRecent } from "@/lib/library/recent";

type PlaylistCard = { id: string; title: string; subtitle?: string; artwork?: string };
type HomeSection =
  | { title: string; kind: "songs"; tracks: Track[] }
  | { title: string; kind: "playlists"; playlists: PlaylistCard[] };

// fetched once per visit, shared across re-opens of the home screen
let feedPromise: Promise<HomeSection[]> | null = null;
const radioCache = new Map<string, Promise<Track[]>>();

function loadFeed() {
  feedPromise ??= fetch("/api/home")
    .then((r) => r.json())
    .then((d: { sections?: HomeSection[] }) => d.sections ?? [])
    .catch(() => {
      feedPromise = null;
      return [];
    });
  return feedPromise;
}

function loadRadio(seed: Track) {
  let p = radioCache.get(seed.videoId);
  if (!p) {
    p = fetch(`/api/radio?id=${encodeURIComponent(seed.videoId)}&artist=${encodeURIComponent(seed.artist)}`)
      .then((r) => r.json())
      .then((d: { tracks?: Track[] }) => (d.tracks ?? []).filter((t) => t.videoId !== seed.videoId).slice(0, 18))
      .catch(() => []);
    radioCache.set(seed.videoId, p);
  }
  return p;
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Listen Now: suggestions to start from, Apple Music style. */
export function HomeView() {
  const { playQueue } = usePlayer();
  const { likes } = useLikes();
  const [recent, setRecent] = useState<Track[]>([]);
  const [feed, setFeed] = useState<HomeSection[] | null>(null);
  const [forYou, setForYou] = useState<{ seed: Track; tracks: Track[] } | null>(null);
  const [hello, setHello] = useState("Listen Now");

  useEffect(() => {
    const r = readRecent();
    // browser-only data (localStorage, clock) is read after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(r);
    setHello(greeting());
    loadFeed().then(setFeed);
  }, []);

  // "Made for you": a radio from the song you played or liked most recently
  const seed = recent[0] ?? likes[0];
  useEffect(() => {
    if (!seed) return;
    let cancelled = false;
    loadRadio(seed).then((tracks) => !cancelled && setForYou({ seed, tracks }));
    return () => {
      cancelled = true;
    };
  }, [seed]);

  const openPlaylist = async (p: PlaylistCard) => {
    const res = await fetch(`/api/playlist?id=${encodeURIComponent(p.id)}`);
    const { tracks } = (await res.json()) as { tracks?: Track[] };
    if (tracks?.length) playQueue(tracks, 0);
  };

  return (
    <div className="h-full overflow-y-auto pb-[240px]">
      <motion.h1
        className="pt-2 text-[clamp(32px,4.2cqw,56px)] font-black tracking-tight"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {hello}
      </motion.h1>
      <p className="mt-1 text-secondary">Pick something to play, or search for any song with Ctrl K.</p>

      {recent.length > 0 && <SongRow title="Jump back in" tracks={recent.slice(0, 16)} onPlay={(i) => playQueue(recent, i)} />}
      {forYou && forYou.tracks.length > 0 && (
        <SongRow
          title="Made for you"
          subtitle={`Because you listened to ${forYou.seed.title}`}
          tracks={forYou.tracks}
          onPlay={(i) => playQueue(forYou.tracks, i)}
        />
      )}
      {feed === null && <RowSkeleton />}
      {feed?.map((s) =>
        s.kind === "songs" ? (
          <SongRow key={s.title} title={s.title} tracks={s.tracks} onPlay={(i) => playQueue(s.tracks, i)} />
        ) : (
          <PlaylistRow key={s.title} title={s.title} playlists={s.playlists} onOpen={openPlaylist} />
        ),
      )}
      {likes.length > 0 && <SongRow title="Your liked songs" tracks={likes.slice(0, 20)} onPlay={(i) => playQueue(likes, i)} />}
      <p className="mt-12 text-xs text-tertiary">
        <a href="/privacy" className="hover:text-foreground">
          Privacy &amp; terms
        </a>
        {" · "}
        <a href="https://github.com/arijit-debug/LyricalStudio-Web" target="_blank" rel="noreferrer" className="hover:text-foreground">
          Source on GitHub
        </a>
        {" · "}Lyrics from lrcmux and LRCLIB
      </p>
    </div>
  );
}

/** A titled, horizontally scrolling row with ‹ › buttons (scrollbars are hidden). */
function Row({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const page = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section>
      {/* arrows sit beside the title, so the floating mini-player never covers them */}
      <div className="mt-9 mb-3 flex items-end gap-4">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
        </div>
        <div className="flex gap-2 pb-0.5">
          {[-1, 1].map((dir) => (
            <button
              key={dir}
              onClick={() => page(dir)}
              aria-label={dir < 0 ? "Scroll left" : "Scroll right"}
              className="glass flex size-9 items-center justify-center rounded-full transition hover:scale-105 hover:bg-white/15 active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={dir < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <div ref={ref} className="-mx-3 flex snap-x scroll-px-3 gap-4 overflow-x-auto px-3 pb-3">
        {children}
      </div>
    </section>
  );
}

function SongRow({ title, subtitle, tracks, onPlay }: { title: string; subtitle?: string; tracks: Track[]; onPlay: (i: number) => void }) {
  return (
    <Row title={title} subtitle={subtitle}>
      {tracks.map((t, i) => (
        <Card key={`${t.videoId}-${i}`} artwork={t.artwork} title={t.title} subtitle={t.artist} onClick={() => onPlay(i)} index={i} />
      ))}
    </Row>
  );
}

function PlaylistRow({ title, playlists, onOpen }: { title: string; playlists: PlaylistCard[]; onOpen: (p: PlaylistCard) => void }) {
  return (
    <Row title={title}>
      {playlists.map((p, i) => (
        <Card key={p.id} artwork={p.artwork} title={p.title} subtitle={p.subtitle} onClick={() => onOpen(p)} index={i} large />
      ))}
    </Row>
  );
}

function Card({
  artwork,
  title,
  subtitle,
  onClick,
  index,
  large,
}: {
  artwork?: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
  index: number;
  large?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`group shrink-0 snap-start text-left ${large ? "w-[190px]" : "w-[158px]"}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.035, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/5 shadow-[0_14px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/10 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 group-hover:scale-[1.02]">
        {artwork && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artwork} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
        )}
        <span className="absolute right-2.5 bottom-2.5 flex size-10 translate-y-1 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow-lg transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M7 4v16l13-8z" />
          </svg>
        </span>
      </div>
      <p className="mt-2 truncate text-[14px] font-semibold">{title}</p>
      {subtitle && <p className="truncate text-[13px] text-secondary">{subtitle}</p>}
    </motion.button>
  );
}

function RowSkeleton() {
  return (
    <section>
      <div className="mt-9 mb-3 h-6 w-40 rounded bg-white/10" />
      <div className="flex gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="w-[158px] shrink-0">
            <div className="aspect-square animate-pulse rounded-2xl bg-white/8" />
            <div className="mt-2 h-3 w-24 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </section>
  );
}
