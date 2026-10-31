import type { ComponentType } from "react";
import type { LyricLine } from "@/lib/types";
import { hashString } from "@/lib/theme/palette";
import { rng, type TemplateProps } from "./shared";
import { Stack } from "./Stack";
import { Burst } from "./Burst";
import { Zoom } from "./Zoom";
import { Scatter } from "./Scatter";
import { Flow } from "./Flow";
import { Vertical } from "./Vertical";

export const TEMPLATES = {
  stack: { name: "Stack", component: Stack },
  burst: { name: "Burst", component: Burst },
  zoom: { name: "Zoom", component: Zoom },
  scatter: { name: "Scatter", component: Scatter },
  flow: { name: "Flow", component: Flow },
  vertical: { name: "Vertical", component: Vertical },
} satisfies Record<string, { name: string; component: ComponentType<TemplateProps> }>;

export type TemplateId = keyof typeof TEMPLATES;
export type TemplateChoice = TemplateId | "auto";

const ENERGETIC = /rock|metal|punk|hip.?hop|rap|electronic|dance|edm|house|techno|drum|dubstep|k-pop|anime/i;
const CALM = /ballad|acoustic|folk|classical|jazz|ambient|soul|r&b|singer|soundtrack|easy|lo-?fi|ghazal|devotional/i;

function pick<T>(r: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [v, w] of weighted) {
    x -= w;
    if (x <= 0) return v;
  }
  return weighted[0][0];
}

/**
 * Pick a motion template for a line (our stand-in for Cotodama's mood analysis):
 * line length, singing speed, genre and chorus repeats.
 * Seeded by song + line text, so repeated lines always get the same look.
 */
export function chooseTemplate(line: LyricLine, songSeed: number, genre?: string): TemplateId {
  const r = rng(songSeed ^ hashString(line.text));
  const n = line.words.length;
  const wps = n / Math.max(0.5, line.end - line.start);
  const energetic = genre ? ENERGETIC.test(genre) : false;
  const calm = genre ? CALM.test(genre) : false;

  if (line.lang === "ja" && n <= 6 && r() < 0.35) return "vertical";
  if (n <= 2) return pick(r, [["burst", 3], ["zoom", 2]]);
  if (n > 10 || wps > 3.6) return "flow";
  if (line.repeats >= 3 && n <= 6) return energetic ? "zoom" : "burst";

  return pick(r, [
    ["stack", calm ? 4 : 3],
    ["scatter", energetic ? 3 : 2],
    ["zoom", energetic ? 3 : 1],
    ["flow", calm ? 3 : 1],
    ["burst", n <= 4 ? 2 : 0.5],
  ]);
}
