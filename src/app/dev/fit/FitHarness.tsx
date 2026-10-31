"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import type { LyricLine, LyricsResult, Track } from "@/lib/types";
import { buildLines, buildUnsyncedLines, parseLrc } from "@/lib/lyrics/parse";
import { readCachedLyrics } from "@/lib/lyrics/cache";
import { fallbackPalette } from "@/lib/theme/palette";
import { TEMPLATES, type Scene, type TemplateId } from "@/templates";
import { langAttr } from "@/templates/shared";
import { LineText } from "@/components/stage/LyricsStage";

const DEFAULT_SONGS = [
  "queen bohemian rhapsody",
  "eminem rap god",
  "taylor swift anti-hero",
  "the weeknd after hours",
  "imagine dragons believer",
  "ed sheeran shape of you",
  "yoasobi idol",
  "lisa gurenge",
  "arijit singh tum hi ho",
  "arijit singh kesariya",
];

/** Stage sizes: 1440x900, 1280x720 and a wide 2200x950 window. */
const SIZES = [
  { w: 1144, h: 704 },
  { w: 984, h: 524 },
  { w: 1900, h: 760 },
];

type Failure = { song: string; template: string; size: string; line: string; word: string; overflow: number; side: string };
type Report = { done: boolean; songs: string[]; checked: number; failures: Failure[]; progress: string };

declare global {
  interface Window {
    __fit?: Report;
  }
}

const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];
const SINGLE_WORD: TemplateId[] = [];

async function loadSong(q: string): Promise<{ name: string; lines: LyricLine[] } | null> {
  const search = (await (await fetch(`/api/search?q=${encodeURIComponent(q)}`)).json()) as { tracks?: Track[] };
  const t = search.tracks?.[0];
  if (!t) return null;
  const params = new URLSearchParams({ title: t.title, artist: t.artist });
  if (t.durationSec) params.set("duration", String(t.durationSec));
  // same local cache the app uses, so the check still runs when LRCLIB is down
  const lyrics =
    readCachedLyrics(`${t.artist}|${t.title}`.toLowerCase()) ??
    ((await (await fetch(`/api/lyrics?${params}`)).json()) as { lyrics: LyricsResult | null }).lyrics;
  if (!lyrics?.raw) return null;
  const duration = t.durationSec ?? 240;
  const lines = lyrics.synced ? buildLines(parseLrc(lyrics.raw), duration) : buildUnsyncedLines(lyrics.raw, duration);
  return { name: `${t.artist} - ${t.title}`, lines };
}

type Batch = { song: string; lines: LyricLine[]; template: TemplateId; size: (typeof SIZES)[number] };

export function FitHarness() {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [report, setReport] = useState<Report>({ done: false, songs: [], checked: 0, failures: [], progress: "loading" });
  const gridRef = useRef<HTMLDivElement>(null);
  const resolveRef = useRef<(() => void) | null>(null);

  // drive the batches: song x layout x size
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const qs = params.get("songs");
      const queries = qs ? qs.split("|") : DEFAULT_SONGS;
      // optional filters: ?templates=slide,zoom&sizes=1144x704
      const onlyTemplates = params.get("templates")?.split(",");
      const onlySizes = params.get("sizes")?.split(",");
      const failures: Failure[] = [];
      const songs: string[] = [];
      let checked = 0;
      for (const q of queries) {
        const song = await loadSong(q).catch(() => null);
        if (!song || cancelled) continue;
        songs.push(`${song.name} (${song.lines.length} lines)`);
        for (const template of TEMPLATE_IDS.filter((t) => !onlyTemplates || onlyTemplates.includes(t))) {
          for (const size of SIZES.filter((z) => !onlySizes || onlySizes.includes(`${z.w}x${z.h}`))) {
            await new Promise<void>((resolve) => {
              resolveRef.current = resolve;
              setBatch({ song: song.name, lines: song.lines, template, size });
            });
            // let fonts, ResizeObservers (graph), layout effects (FitBox) and animations settle:
            // wait until every word's on-screen position stops changing
            await document.fonts.ready;
            const grid = gridRef.current!;
            const signature = () => {
              let sum = 0;
              grid.querySelectorAll<HTMLElement>("[data-fit]").forEach((el) => {
                const r = el.getBoundingClientRect();
                sum += r.left * 3 + r.top * 7 + r.width * 11 + r.height * 13;
              });
              return Math.round(sum);
            };
            let prev = NaN;
            for (let i = 0; i < 60; i++) {
              await new Promise((r) => setTimeout(r, 200));
              const sig = signature();
              if (sig === prev) break;
              prev = sig;
            }
            grid.querySelectorAll<HTMLElement>("[data-case]").forEach((c) => {
              const box = c.getBoundingClientRect();
              checked++;
              let worst = 0;
              let worstWord = "";
              let side = "";
              c.querySelectorAll<HTMLElement>("[data-fit]").forEach((el) => {
                const r = el.getBoundingClientRect();
                if (!r.width) return;
                const sides = { left: box.left - r.left, right: r.right - box.right, top: box.top - r.top, bottom: r.bottom - box.bottom };
                for (const [k, over] of Object.entries(sides)) {
                  if (over > worst) {
                    worst = over;
                    worstWord = el.textContent ?? "";
                    side = k;
                  }
                }
              });
              if (worst > 1) {
                failures.push({
                  song: song.name,
                  template,
                  size: `${size.w}x${size.h}`,
                  line: c.dataset.case ?? "",
                  word: worstWord.slice(0, 40),
                  overflow: Math.round(worst),
                  side,
                });
              }
            });
            setReport({ done: false, songs, checked, failures: [...failures], progress: `${song.name} / ${template} / ${size.w}x${size.h}` });
          }
        }
      }
      if (!cancelled) setReport({ done: true, songs, checked, failures, progress: "done" });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (batch) {
      const r = resolveRef.current;
      resolveRef.current = null;
      requestAnimationFrame(() => requestAnimationFrame(() => r?.()));
    }
  }, [batch]);

  useEffect(() => {
    window.__fit = report;
  }, [report]);

  const palette = fallbackPalette(0);
  const cases: { line: LyricLine; revealed: number; key: string }[] = [];
  if (batch) {
    batch.lines.forEach((line, li) => {
      if (SINGLE_WORD.includes(batch.template)) {
        // one word at a time: the longest word is the worst case for fitting
        let wi = 0;
        line.words.forEach((w, i) => w.text.length > line.words[wi].text.length && (wi = i));
        cases.push({ line, revealed: wi + 1, key: `${li}-${wi}` });
      } else cases.push({ line, revealed: line.words.length, key: `${li}` });
    });
  }

  return (
    <MotionConfig reducedMotion="always">
      <main className="min-h-screen bg-neutral-900 p-4 text-sm text-white">
        <p className="mb-2 font-mono">
          {report.done ? "DONE" : "RUNNING"} · checked {report.checked} · failures {report.failures.length} · {report.progress}
        </p>
        <div ref={gridRef} className="flex flex-wrap gap-2">
          {batch &&
            cases.map((c, i) => {
              const tilt = batch.template === "graph" ? 0 : i % 2 ? 3.5 : -3.5;
              const scene: Scene = { template: batch.template, tilt };
              return (
                <div
                  // fresh mount per batch, exactly like a new lyric line in the app
                  key={`${batch.template}-${batch.size.w}-${batch.song}-${c.key}`}
                  data-case={c.line.text}
                  className="relative bg-black outline outline-1 outline-white/20"
                  style={{ width: batch.size.w, height: batch.size.h, containerType: "size" }}
                >
                  <div lang={langAttr(c.line.lang)} className="absolute inset-0 uppercase">
                    <LineText line={c.line} scene={scene} revealed={c.revealed} palette={palette} seed={i * 7919} />
                  </div>
                </div>
              );
            })}
        </div>
      </main>
    </MotionConfig>
  );
}
