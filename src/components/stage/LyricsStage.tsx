"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotionConfig } from "motion/react";
import { springTiming } from "@/templates/waapi";
import type { LyricLine, Track } from "@/lib/types";
import type { Palette } from "@/lib/theme/palette";
import { hashString } from "@/lib/theme/palette";
import { detectLang, lineAt } from "@/lib/lyrics/parse";
import type { LyricsStatus } from "@/lib/lyrics/useTrackData";
import { chooseScene, TEMPLATES, type Scene, type TemplateChoice } from "@/templates";
import { FitBox } from "@/templates/FitBox";
import { langAttr, vivid } from "@/templates/shared";
import { TitleCard } from "./TitleCard";

/** No continuous camera zoom: scaling text over a whole line makes the browser draw it as a
 * stretched bitmap (slightly soft). Words stay crisp vector text once they settle. */
const CAMERA_ZOOM = 1;

/** Show lyrics slightly early: reading takes a moment, and the player reports late. */
const LEAD_SECONDS = 0.15;

type Position = { mode: "intro" | "line" | "gap" | "outro"; line: number; revealed: number };

type Props = {
  track: Track;
  lines: LyricLine[];
  status: LyricsStatus;
  palette: Palette;
  seed: number;
  genre?: string;
  /** source of plain (unsynced) lyrics, shown with the timing note */
  lyricsCredit?: string;
  offset: number;
  template: TemplateChoice;
  getTime: () => number;
};

export function LyricsStage({ track, lines, status, palette, seed, genre, lyricsCredit, offset, template, getTime }: Props) {
  const [pos, setPos] = useState<Position>({ mode: "intro", line: -1, revealed: 0 });
  const posRef = useRef(pos);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = getTime() + LEAD_SECONDS - offset;
      const li = lineAt(lines, t);
      let next: Position;
      if (li < 0) next = { mode: "intro", line: -1, revealed: 0 };
      else {
        const line = lines[li];
        if (t > line.end) next = { mode: li === lines.length - 1 ? "outro" : "gap", line: li, revealed: 0 };
        else {
          let revealed = 0;
          while (revealed < line.words.length && line.words[revealed].start <= t) revealed++;
          next = { mode: "line", line: li, revealed: Math.max(1, revealed) };
        }
      }
      const p = posRef.current;
      if (p.mode !== next.mode || p.line !== next.line || p.revealed !== next.revealed) {
        posRef.current = next;
        setPos(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, offset, getTime]);

  // Tell the glass background where each new word landed, so it can ripple from there.
  const rootRef = useRef<HTMLDivElement>(null);
  const lastRipple = useRef({ line: -1, revealed: 0 });
  useEffect(() => {
    if (pos.mode !== "line") return;
    const prev = lastRipple.current;
    if (pos.line === prev.line && pos.revealed <= prev.revealed) return;
    lastRipple.current = { line: pos.line, revealed: pos.revealed };
    const newLine = pos.line !== prev.line;
    const word = lines[pos.line]?.words[pos.revealed - 1];
    // wait a frame so the word's element is laid out
    const id = requestAnimationFrame(() => {
      const els = rootRef.current?.querySelectorAll<HTMLElement>(`[data-line="${pos.line}"] [data-fit]`);
      const el = els?.length ? els[Math.min(pos.revealed - 1, els.length - 1)] : null;
      const r = el?.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent("ls:word", {
          detail: {
            x: r ? (r.left + r.width / 2) / window.innerWidth : 0.5,
            y: r ? (r.top + r.height / 2) / window.innerHeight : 0.5,
            strength: word?.emphasis ? 1.5 : newLine ? 1.2 : 0.85,
            newLine,
          },
        }),
      );
    });
    return () => cancelAnimationFrame(id);
  }, [pos, lines]);

  const noLyrics = status !== "synced" && status !== "unsynced";
  const caption =
    status === "loading"
      ? "Finding lyrics…"
      : status === "instrumental"
        ? "Instrumental"
        : status === "unavailable"
          ? "The lyrics service is busy right now. Retrying…"
          : status === "none"
          ? "No lyrics found for this song"
          : status === "unsynced"
            ? `Timing is estimated for this song${lyricsCredit ? ` · lyrics from ${lyricsCredit}` : ""}`
            : undefined;

  let content: React.ReactNode;
  let key: string;
  if (noLyrics || pos.mode === "intro" || pos.mode === "outro") {
    key = noLyrics ? `title-${status}` : pos.mode;
    content = (
      <FitBox>
        <TitleCard track={track} palette={palette} caption={noLyrics ? caption : undefined} small={pos.mode === "outro"} />
      </FitBox>
    );
  } else if (pos.mode === "gap") {
    key = `gap-${pos.line}`;
    content = <Interlude color={vivid(palette.accents[pos.line % 3])} />;
  } else {
    const line = lines[pos.line];
    const lineSeed = (seed ^ hashString(line.text)) >>> 0;
    const scene = chooseScene(line, seed, genre, template === "auto" ? undefined : template);
    key = `line-${pos.line}`;
    content = (
      <div data-line={pos.line} lang={langAttr(line.lang)} className="absolute inset-0 flex items-center justify-center uppercase">
        <LineText line={line} scene={scene} revealed={pos.revealed} palette={palette} seed={lineSeed} />
        {line.sub && (
          <motion.p
            lang={langAttr(detectLang(line.sub))}
            className="absolute bottom-[2cqh] max-w-[80cqw] text-center text-[clamp(15px,1.5cqw,22px)] font-medium normal-case text-secondary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {line.sub}
          </motion.p>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden" aria-live="off">
      <AnimatePresence initial={false}>
        <motion.div
          key={key}
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
      {status === "unsynced" && (
        <p className="absolute top-2 left-1/2 -translate-x-1/2 text-sm text-secondary">{caption}</p>
      )}
    </div>
  );
}

/**
 * One lyric line: camera (tilt + slow push-in) > FitBox (keeps it on screen) > layout.
 * Shared by the stage and the fit test page so both render exactly the same thing.
 */
export function LineText({
  line,
  scene,
  revealed,
  palette,
  seed,
}: {
  line: LyricLine;
  scene: Scene;
  revealed: number;
  palette: Palette;
  seed: number;
}) {
  const Template = TEMPLATES[scene.template].component;
  const camRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionConfig() ?? false;

  // camera on the compositor thread: the line settles into its tilt, then holds still
  useLayoutEffect(() => {
    const el = camRef.current;
    if (!el) return;
    el.style.rotate = scene.tilt ? `${scene.tilt}deg` : "";
    if (reduce || !scene.tilt) return;
    const settle = springTiming(40, 13, 1);
    const tilt = el.animate([{ rotate: `${scene.tilt * 1.3}deg` }, { rotate: `${scene.tilt}deg` }], { duration: settle.duration, easing: settle.easing, fill: "backwards" });
    return () => tilt.cancel();
  }, [scene.tilt, reduce]);

  return (
    <div ref={camRef} className="absolute inset-0 flex items-center justify-center">
      {/* the graph frames itself (it shrinks to fit, and pans only for very long lines) */}
      <FitBox disabled={scene.template === "graph"} tilt={scene.tilt * 1.3} zoom={CAMERA_ZOOM} insets={line.sub ? { bottom: 0.16 } : undefined}>
        <Template line={line} revealed={revealed} palette={palette} seed={seed} />
      </FitBox>
    </div>
  );
}

function Interlude({ color }: { color: string }) {
  return (
    <div className="flex gap-4" aria-label="Instrumental">
      {[0, 1, 2].map((i) => (
        <span key={i} className="interlude-dot block size-4 rounded-full" style={{ background: color, animationDelay: `${i * 0.22}s` }} />
      ))}
    </div>
  );
}
