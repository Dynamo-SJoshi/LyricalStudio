"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { UserMenu } from "@/components/auth/UserMenu";
import { PlayerProvider, usePlayer } from "@/components/player/PlayerProvider";
import { ControlBar } from "@/components/player/ControlBar";
import { UpNext } from "@/components/player/UpNext";
import { YouTubeTile } from "@/components/player/YouTubeTile";
import { SearchPanel } from "@/components/search/SearchPanel";
import { AmbientBackground } from "@/components/stage/AmbientBackground";
import { LyricsStage } from "@/components/stage/LyricsStage";
import { LikesProvider } from "@/lib/library/likes";
import { readOffset, writeOffset } from "@/lib/library/recent";
import { useTrackData } from "@/lib/lyrics/useTrackData";
import { TEMPLATES, type TemplateChoice } from "@/templates";
import { GooeyDefs } from "@/templates/kinetic";

export function AppShell() {
  return (
    // honors the OS "reduce motion" setting for every animation
    <MotionConfig reducedMotion="user">
      <GooeyDefs />
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </MotionConfig>
  );
}

function Gate() {
  const { enabled, loading, user } = useAuth();
  if (enabled && loading) return <main className="flex-1 bg-black" />;
  if (enabled && !user) return <LoginScreen />;
  return (
    <LikesProvider>
      <PlayerProvider>
        <Studio />
      </PlayerProvider>
    </LikesProvider>
  );
}

function Studio() {
  const { current, duration, getTime, toggle, seek } = usePlayer();
  const data = useTrackData(current, duration);
  const [template, setTemplateState] = useState<TemplateChoice>("auto");
  const [offset, setOffsetState] = useState(0);

  // restore preferences after mount (localStorage isn't available during prerender)
  useEffect(() => {
    const saved = localStorage.getItem("ls:template");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "auto" || (saved && saved in TEMPLATES)) setTemplateState(saved as TemplateChoice);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current) setOffsetState(readOffset(current));
  }, [current]);

  const setTemplate = (t: TemplateChoice) => {
    setTemplateState(t);
    localStorage.setItem("ls:template", t);
  };
  const setOffset = useCallback(
    (v: number) => {
      const rounded = Math.round(v * 100) / 100;
      setOffsetState(rounded);
      if (current) writeOffset(current, rounded);
    },
    [current],
  );

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el instanceof HTMLInputElement && el.type !== "range") return;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight") seek(getTime() + 5);
      else if (e.key === "ArrowLeft") seek(getTime() - 5);
      else if (e.key === "[") setOffset(offset - 0.25);
      else if (e.key === "]") setOffset(offset + 0.25);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seek, getTime, offset, setOffset]);

  return (
    <>
      <AmbientBackground palette={data.palette} artwork={data.artwork} />

      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-4 px-6 pt-5">
        <span className="w-[200px] text-lg font-black tracking-tight">LyricalStudio</span>
        <SearchPanel />
        <div className="flex w-[200px] justify-end">
          <UserMenu />
        </div>
      </header>

      {/* lyrics stage: sized with container units so lyrics never run under the video tile */}
      <main className="fixed top-[76px] bottom-[120px] left-6 right-[272px] z-10" style={{ containerType: "size" }}>
        {current ? (
          <LyricsStage
            track={current}
            lines={data.lines}
            status={data.status}
            palette={data.palette}
            seed={data.seed}
            genre={data.genre}
            offset={offset}
            template={template}
            getTime={getTime}
          />
        ) : (
          <Welcome />
        )}
      </main>

      <aside className="fixed top-[76px] right-6 bottom-[120px] z-20 flex w-[224px] flex-col gap-4">
        <UpNext />
        <YouTubeTile />
      </aside>

      <footer className="fixed inset-x-6 bottom-5 z-30">
        <ControlBar offset={offset} onOffset={setOffset} template={template} onTemplate={setTemplate} />
      </footer>
    </>
  );
}

function Welcome() {
  const words = ["Lyrics,", "in", "motion."];
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <h1 className="flex flex-wrap justify-center gap-x-[0.25em] text-[min(11cqw,22cqh)] leading-none font-black tracking-tighter">
        {words.map((w, i) => (
          <motion.span
            key={w}
            initial={{ y: 60, opacity: 0, filter: "blur(16px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.15 + i * 0.25, type: "spring", stiffness: 160, damping: 22 }}
            style={{ color: i === 2 ? "var(--system-pink)" : undefined }}
          >
            {w}
          </motion.span>
        ))}
      </h1>
      <motion.p
        className="mt-6 text-lg text-secondary"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Search for a song to begin. Press <kbd className="rounded border border-white/20 px-1">Ctrl K</kbd> anytime.
      </motion.p>
    </div>
  );
}
