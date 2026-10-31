import type { ComponentType } from "react";
import type { LyricLine } from "@/lib/types";
import { hashString } from "@/lib/theme/palette";
import { rng, type TemplateProps } from "./shared";
import type { GlassKind } from "./decor";
import { Stack } from "./Stack";
import { Burst } from "./Burst";
import { Zoom } from "./Zoom";
import { Scatter } from "./Scatter";
import { Flow } from "./Flow";
import { Vertical } from "./Vertical";
import { Slide } from "./Slide";
import { Letters } from "./Letters";
import { Graph } from "./Graph";
import { Morph } from "./Morph";

export const TEMPLATES = {
  stack: { name: "Stack", component: Stack },
  slide: { name: "Slide", component: Slide },
  burst: { name: "Burst", component: Burst },
  morph: { name: "Morph", component: Morph },
  zoom: { name: "Zoom", component: Zoom },
  letters: { name: "Letters", component: Letters },
  scatter: { name: "Scatter", component: Scatter },
  graph: { name: "Graph", component: Graph },
  flow: { name: "Flow", component: Flow },
  vertical: { name: "Vertical", component: Vertical },
} satisfies Record<string, { name: string; component: ComponentType<TemplateProps> }>;

export type TemplateId = keyof typeof TEMPLATES;
export type TemplateChoice = TemplateId | "auto";

/** Everything that makes up one line's visual: layout, glass effects, and camera. */
export type Scene = {
  template: TemplateId;
  /** a tinted Liquid Glass shape behind the words */
  glass?: GlassKind;
  /** glass droplets rising as words are sung */
  droplets?: boolean;
  /** degrees; Cotodama often sets a line at a slight angle */
  tilt: number;
};

const ENERGETIC = /rock|metal|punk|hip.?hop|rap|electronic|dance|edm|house|techno|drum|dubstep|k-pop|anime|pop/i;
const CALM = /ballad|acoustic|folk|classical|jazz|ambient|soul|r&b|singer|soundtrack|easy|lo-?fi|ghazal|devotional|bollywood/i;

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
 * Pick a scene for a line (our stand-in for Cotodama's mood analysis):
 * line length, singing speed, genre and chorus repeats.
 * Seeded by song + line text, so repeated lines (the chorus) always look the same.
 */
export function chooseScene(line: LyricLine, songSeed: number, genre?: string, forced?: TemplateId): Scene {
  const r = rng(songSeed ^ hashString(line.text));
  const n = line.words.length;
  const wps = n / Math.max(0.5, line.end - line.start);
  const energetic = genre ? ENERGETIC.test(genre) && !CALM.test(genre) : wps > 2.5;
  const calm = genre ? CALM.test(genre) : wps < 1.4;
  const chorus = line.repeats >= 3;

  let template: TemplateId;
  if (forced) template = forced;
  else if (line.lang === "ja" && n <= 6 && r() < 0.3) template = "vertical";
  else if (n <= 2) template = pick(r, [["morph", 3], ["burst", 2], ["zoom", 2], ["letters", 2]]);
  else if (n > 11 || wps > 3.8) template = pick(r, [["flow", 3], ["slide", 2]]);
  else if (chorus && n <= 7) template = energetic ? pick(r, [["zoom", 2], ["slide", 2], ["letters", 1]]) : pick(r, [["morph", 2], ["burst", 2], ["letters", 1]]);
  else
    template = pick(r, [
      ["stack", calm ? 3 : 2],
      ["slide", energetic ? 3 : 2],
      ["graph", n <= 8 ? (calm ? 2.5 : 1.5) : 0],
      ["scatter", energetic ? 2 : 1],
      ["zoom", energetic ? 2 : 1],
      ["letters", 1.5],
      ["flow", calm ? 2 : 0.5],
      ["burst", n <= 4 ? 2 : 0.3],
      ["morph", n <= 5 ? 2 : 0],
    ]);

  // a tinted glass shape behind the words (more often in the chorus and energetic songs)
  const glassChance = chorus ? 0.75 : energetic ? 0.55 : 0.4;
  const glass =
    r() < glassChance
      ? pick<GlassKind>(r, [
          ["pane", template === "graph" ? 0 : 3],
          ["lens", 2],
          ["capsule", template === "vertical" || template === "graph" ? 0 : 2],
        ])
      : undefined;
  const droplets = r() < (energetic ? 0.7 : 0.35);

  const tilt = template === "vertical" || template === "graph" || r() > 0.32 ? 0 : (r() - 0.5) * 7;

  return { template, glass, droplets, tilt };
}
