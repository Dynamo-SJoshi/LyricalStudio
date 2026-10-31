"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LyricLine, Track } from "@/lib/types";
import type { Palette } from "@/lib/theme/palette";
import { hashString } from "@/lib/theme/palette";
import { detectLang, lineAt } from "@/lib/lyrics/parse";
import type { LyricsStatus } from "@/lib/lyrics/useTrackData";
import { chooseScene, TEMPLATES, type TemplateChoice } from "@/templates";
import { OverLayer, UnderLayer } from "@/templates/decor";
import { langAttr, rng } from "@/templates/shared";
import { TitleCard } from "./TitleCard";

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
    content = <TitleCard track={track} palette={palette} caption={noLyrics ? caption : undefined} small={pos.mode === "outro"} />;
  } else if (pos.mode === "gap") {
    const prev = lines[pos.line];
    key = `gap-${pos.line}`;
    content = (
      <>
        <UnderLayer kinds={["network", "outlines"]} line={prev} revealed={prev.words.length} palette={palette} seed={seed ^ pos.line} />
        <Interlude color={palette.accents[pos.line % 3]} />
      </>
    );
  } else {
    const line = lines[pos.line];
    const lineSeed = seed ^ hashString(line.text);
    const scene = chooseScene(line, seed, genre, template === "auto" ? undefined : template);
    const Template = TEMPLATES[scene.template].component;
    const decor = { line, revealed: pos.revealed, palette, seed: lineSeed };
    key = `line-${pos.line}`;
    content = (
      <div lang={langAttr(line.lang)} className="absolute inset-0 flex items-center justify-center uppercase">
        <UnderLayer kinds={scene.under} {...decor} />
        {/* camera: settle into the tilt, then a slow push-in for the life of the line */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ rotate: scene.tilt * 1.8, scale: 0.94 }}
          animate={{ rotate: scene.tilt, scale: 1.05 }}
          transition={{
            rotate: { type: "spring", stiffness: 90, damping: 16 },
            scale: { duration: Math.max(1.5, line.end - line.start), ease: "linear" },
          }}
        >
          <Template line={line} revealed={pos.revealed} palette={palette} seed={lineSeed} />
        </motion.div>
        <OverLayer kind={scene.over} {...decor} />
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
        {echoLine && <Echo key={`echo-${pos.line}`} line={echoLine} color={palette.accents[(pos.line + 1) % 3]} seed={seed ^ pos.line} />}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        <motion.div
          key={key}
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.18 } }}
          exit={{ opacity: 0, scale: 0.97, filter: "blur(10px)", transition: { duration: 0.32, ease: [0.4, 0, 1, 1] } }}
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

function Echo({ line, color, seed }: { line: LyricLine; color: string; seed: number }) {
  const r = rng(seed);
  const words = line.words.slice(-2).map((w) => w.text).join(" ");
  const left = r() < 0.5;
  return (
    <motion.p
      aria-hidden
      lang={langAttr(line.lang)}
      className="pointer-events-none absolute font-black whitespace-nowrap uppercase"
      style={{
        color,
        fontSize: "min(9cqw, 16cqh)",
        [left ? "left" : "right"]: "4cqw",
        top: `${(r() < 0.5 ? 8 : 70) + r() * 10}cqh`,
      }}
      initial={{ opacity: 0.75, x: 0, filter: "blur(0px)" }}
      animate={{ opacity: 0, x: `${left ? -6 : 6}cqw`, filter: "blur(6px)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2.2, ease: "easeOut" }}
    >
      {words}
    </motion.p>
  );
}

function Interlude({ color }: { color: string }) {
  return (
    <div className="flex gap-4" aria-label="Instrumental">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="interlude-dot block size-5 rounded-full"
          style={{ background: color, animationDelay: `${i * 0.22}s` }}
        />
      ))}
    </div>
  );
}
