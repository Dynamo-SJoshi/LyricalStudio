"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LyricLine, Track } from "@/lib/types";
import type { Palette } from "@/lib/theme/palette";
import { hashString } from "@/lib/theme/palette";
import { detectLang, lineAt } from "@/lib/lyrics/parse";
import type { LyricsStatus } from "@/lib/lyrics/useTrackData";
import { chooseTemplate, TEMPLATES, type TemplateChoice } from "@/templates";
import { langAttr } from "@/templates/shared";
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
    key = `gap-${pos.line}`;
    content = <Interlude color={palette.accents[pos.line % 3]} />;
  } else {
    const line = lines[pos.line];
    const id = template === "auto" ? chooseTemplate(line, seed, genre) : template;
    const Template = TEMPLATES[id].component;
    key = `line-${pos.line}`;
    content = (
      <div lang={langAttr(line.lang)} className="flex h-full w-full flex-col items-center justify-center">
        <Template line={line} revealed={pos.revealed} palette={palette} seed={seed ^ hashString(line.text)} />
        {line.sub && (
          <motion.p
            lang={langAttr(detectLang(line.sub))}
            className="absolute bottom-[2cqh] max-w-[80cqw] text-center text-[clamp(15px,1.5cqw,22px)] font-medium text-secondary"
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
    <div className="relative h-full w-full" aria-live="off">
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
