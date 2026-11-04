"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { PlayerProvider, usePlayer } from "@/components/player/PlayerProvider";
import { ControlBar } from "@/components/player/ControlBar";
import { SideRail } from "@/components/player/SideRail";
import { HomeView } from "@/components/home/HomeView";
import { FullscreenButton } from "@/components/FullscreenButton";
import { YouTubeTile } from "@/components/player/YouTubeTile";
import { SearchPanel } from "@/components/search/SearchPanel";
import { AmbientBackground } from "@/components/stage/AmbientBackground";
import { FpsMeter } from "@/components/FpsMeter";
import { MobileNotice } from "@/components/MobileNotice";
import { LyricsStage } from "@/components/stage/LyricsStage";
import { LikesProvider } from "@/lib/library/likes";
import { readOffset, writeOffset } from "@/lib/library/recent";
import { useTrackData } from "@/lib/lyrics/useTrackData";
import { TEMPLATES, type TemplateChoice } from "@/templates";
import { LogoMark } from "./LogoMark";

/** Idle time before immersive mode hides the controls, ms. */
const IMMERSIVE_IDLE_MS = 3000;

export function AppShell() {
  return (
    // honors the OS "reduce motion" setting for every animation
    <MotionConfig reducedMotion="user">
      <LikesProvider>
        <PlayerProvider>
          <Studio />
        </PlayerProvider>
      </LikesProvider>
      <MobileNotice />
    </MotionConfig>
  );
}

function Studio() {
  const { current, duration, status, getTime, toggle, seek, captions, setCaptions } = usePlayer();
  const data = useTrackData(current, duration);
  const [template, setTemplateState] = useState<TemplateChoice>("auto");
  const [offset, setOffsetState] = useState(0);
  // a new random value every time a song starts, so highlights (and layouts) vary per play
  const [playNonce, setPlayNonce] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current) setPlayNonce(Math.floor(Math.random() * 0xffffffff));
  }, [current?.videoId]); // eslint-disable-line react-hooks/exhaustive-deps
  // "home" = suggestions, "lyrics" = the stage; a new song switches to lyrics
  const [view, setView] = useState<"home" | "lyrics">("home");
  const [videoBig, setVideoBig] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current) setView("lyrics");
  }, [current?.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // YouTube captions for songs without lyrics: once turned on, they stay on for every
  // such song (and the video grows so they're readable) until turned off
  const [captionsPref, setCaptionsPref] = useState(false);
  const captionsGrewVideo = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCaptionsPref(localStorage.getItem("ls:captions") === "on");
  }, []);
  const lyricsStatus = data.status;
  useEffect(() => {
    if (!current || lyricsStatus === "loading") return;
    const want = captionsPref && lyricsStatus === "none";
    setCaptions(want);
    if (want && !captionsGrewVideo.current) {
      captionsGrewVideo.current = true;
      setVideoBig(true);
    } else if (!want && captionsGrewVideo.current) {
      captionsGrewVideo.current = false;
      setVideoBig(false);
    }
  }, [captionsPref, lyricsStatus, current?.videoId, setCaptions]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleCaptions = useCallback((on: boolean) => {
    setCaptionsPref(on);
    localStorage.setItem("ls:captions", on ? "on" : "off");
  }, []);

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

  // Immersive mode (Graph styles, while playing): after a few idle seconds the header,
  // control bar and cursor fade away so the lyrics own the screen. Any mouse movement,
  // click, scroll or key brings them back. The YouTube tile always stays visible.
  const immersive = view === "lyrics" && !!current && status === "playing" && template === "graph";
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!immersive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIdle(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const typing = () => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
    };
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!typing()) setIdle(true);
      }, IMMERSIVE_IDLE_MS);
    };
    wake();
    const events = ["pointermove", "pointerdown", "wheel", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [immersive]);
  const hideChrome = immersive && idle;
  useEffect(() => {
    document.documentElement.style.cursor = hideChrome ? "none" : "";
  }, [hideChrome]);
  const chrome = `transition-opacity duration-700 ${hideChrome ? "pointer-events-none opacity-0" : "opacity-100"}`;

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
      else if (e.key === "Escape") setVideoBig(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seek, getTime, offset, setOffset]);

  return (
    <>
      <AmbientBackground palette={data.palette} artwork={data.artwork} />
      <FpsMeter />

      <header className={`fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-4 px-6 pt-5 ${chrome}`}>
        <div className="flex w-[260px] items-center gap-3">
          <button onClick={() => setView("home")} className="flex items-center gap-2.5 text-lg font-black tracking-tight" title="Home">
            <LogoMark size={28} />
            <span>
              Lyrical<span className="font-bold text-secondary">Studio</span>
            </span>
          </button>
          {current && (
            <button
              onClick={() => setView(view === "home" ? "lyrics" : "home")}
              className="glass rounded-full px-3 py-1.5 text-[12px] font-medium transition hover:bg-white/15"
            >
              {view === "home" ? "Now playing" : "Home"}
            </button>
          )}
        </div>
        <SearchPanel />
        <div className="flex w-[300px] items-center justify-end gap-2">
          {current && <SideRail videoBig={videoBig} onToggleVideo={() => setVideoBig((v) => !v)} />}
          <FullscreenButton />
        </div>
      </header>

      {/* lyrics stage: sized with container units so lyrics never run under the video tile */}
      <main
        className={`fixed top-[76px] bottom-[120px] left-6 z-10 ${view === "home" || !current ? "right-6" : videoBig ? "right-[calc(min(720px,58vw)+60px)]" : "right-[248px]"}`}
        style={{ containerType: "size" }}
      >
        {view === "home" || !current ? (
          <HomeView />
        ) : (
          <LyricsStage
            track={current}
            lines={data.lines}
            status={data.status}
            palette={data.palette}
            seed={(data.seed ^ playNonce) >>> 0}
            genre={data.genre}
            lyricsCredit={data.lyricsCredit}
            offset={offset}
            template={template}
            getTime={getTime}
            captions={captions}
            onCaptions={toggleCaptions}
          />
        )}
      </main>

      <YouTubeTile big={videoBig} onShrink={() => setVideoBig(false)} lowered={hideChrome} />

      <footer className={`fixed inset-x-6 bottom-5 z-30 ${chrome}`}>
        <ControlBar offset={offset} onOffset={setOffset} template={template} onTemplate={setTemplate} />
      </footer>
    </>
  );
}
