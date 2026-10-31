"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LyricLine, Track } from "@/lib/types";
import type { Palette } from "@/lib/theme/palette";
import { hashString } from "@/lib/theme/palette";
import { detectLang, lineAt } from "@/lib/lyrics/parse";
import type { LyricsStatus } from "@/lib/lyrics/useTrackData";
import { chooseScene, TEMPLATES, type Scene, type TemplateChoice } from "@/templates";
import { FitBox } from "@/templates/FitBox";
import { GlassInterlude, SceneFx } from "@/templates/decor";
import { fitFont, glassVars, langAttr, rng } from "@/templates/shared";
import { TitleCard } from "./TitleCard";

/** How far the camera pushes in over a line (FitBox accounts for it). */
const CAMERA_ZOOM = 1.03;

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
  offset: number;
  template: TemplateChoice;
  getTime: () => number;
};

export function LyricsStage({ track, lines, status, palette, seed, genre, offset, template, getTime }: Props) {
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
        if (next.mode === "line" && (next.line !== p.line || next.revealed > p.revealed)) {
          window.dispatchEvent(new CustomEvent("ls:word", { detail: { index: next.revealed } }));
        }
        posRef.current = next;
        setPos(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, offset, getTime]);

  const noLyrics = status !== "synced" && status !== "unsynced";
  const caption =
    status === "loading"
      ? "Finding lyrics…"
      : status === "instrumental"
        ? "Instrumental"
        : status === "none"
          ? "No lyrics found for this song"
          : status === "unsynced"
            ? "Lyrics aren't time-synced for this song, so timing is approximate"
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
    content = <GlassInterlude palette={palette} seed={(seed ^ pos.line) >>> 0} />;
  } else {
    const line = lines[pos.line];
    const lineSeed = (seed ^ hashString(line.text)) >>> 0;
    const scene = chooseScene(line, seed, genre, template === "auto" ? undefined : template);
    const decor = { line, revealed: pos.revealed, palette, seed: lineSeed };
    key = `line-${pos.line}`;
    content = (
      <div lang={langAttr(line.lang)} className="lyric-pop absolute inset-0 flex items-center justify-center uppercase">
        <SceneFx glass={scene.glass} droplets={scene.droplets} {...decor} />
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

  // the end of the previous line lingers in color as the new one arrives
  const echoLine = pos.mode === "line" && pos.line > 0 ? lines[pos.line - 1] : null;

  return (
    <div className="relative h-full w-full overflow-hidden" aria-live="off">
      <AnimatePresence>
        {echoLine && <Echo key={`echo-${pos.line}`} line={echoLine} color={palette.accents[(pos.line + 1) % 3]} seed={(seed ^ pos.line) >>> 0} />}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        <motion.div
          key={key}
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } }}
          exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}
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
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      style={{ willChange: "transform" }}
      initial={{ rotate: scene.tilt * 1.3, scale: 0.97 }}
      animate={{ rotate: scene.tilt, scale: CAMERA_ZOOM }}
      transition={{
        rotate: { type: "spring", stiffness: 40, damping: 13 },
        // a slow, steady push-in, like a camera dolly
        scale: { duration: Math.max(2, line.end - line.start), ease: [0.25, 0.1, 0.25, 1] },
      }}
    >
      {/* the graph frames itself (it shrinks to fit, and pans only for very long lines) */}
      <FitBox disabled={scene.template === "graph"} tilt={scene.tilt * 1.3} zoom={CAMERA_ZOOM} insets={line.sub ? { bottom: 0.16 } : undefined}>
        <Template line={line} revealed={revealed} palette={palette} seed={seed} />
      </FitBox>
    </motion.div>
  );
}

function Echo({ line, color, seed }: { line: LyricLine; color: string; seed: number }) {
  const r = rng(seed);
  const words = line.words.slice(-2).map((w) => w.text).join(" ");
  const left = r() < 0.5;
  // sized to fit, and it drifts upward (not off the side) as it fades
  const fontSize = fitFont([words], { widthVw: 52, maxVw: 9, heightVh: 16 });
  return (
    <motion.p
      aria-hidden
      lang={langAttr(line.lang)}
      className="glass-glyph pointer-events-none absolute font-black whitespace-nowrap uppercase"
      style={{
        color,
        ...glassVars(color),
        fontSize,
        [left ? "left" : "right"]: "5cqw",
        top: `${(r() < 0.5 ? 10 : 68) + r() * 8}cqh`,
      }}
      initial={{ opacity: 0.7, y: "0cqh" }}
      animate={{ opacity: 0, y: "-4cqh" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2.2, ease: "easeOut" }}
    >
      {words}
    </motion.p>
  );
}
