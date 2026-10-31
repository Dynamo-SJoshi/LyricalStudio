"use client";

import { motion } from "motion/react";
import type { Track } from "@/lib/types";
import type { Palette } from "@/lib/theme/palette";
import { fillStyle, fitFont, vivid, type WordLook } from "@/templates/shared";

/** Song title card: shown before the first lyric, at the end, and when there are no lyrics. */
export function TitleCard({
  track,
  palette,
  caption,
  small,
}: {
  track: Track;
  palette: Palette;
  caption?: string;
  small?: boolean;
}) {
  const words = track.title.split(/\s+/);
  const fontSize = fitFont([track.title.length > 18 ? words.slice(0, Math.ceil(words.length / 2)).join(" ") : track.title], {
    maxVw: small ? 6 : 10,
    heightVh: 40,
  });

  return (
    <div className="flex max-w-[84cqw] flex-col items-center text-center">
      <motion.h2
        data-fit=""
        className="font-black leading-[1.02] tracking-tighter"
        style={{ fontSize, ...fillStyle(titleLook(palette)) }}
        // the glow lives in the same filter the entrance animates (so it isn't overwritten)
        initial={{ y: 40, opacity: 0, filter: `blur(16px) drop-shadow(0 0 0.35em ${vivid(palette.accents[0], 0.6)})` }}
        animate={{ y: 0, opacity: 1, filter: `blur(0px) drop-shadow(0 0 0.35em ${vivid(palette.accents[0], 0.6)})` }}
        transition={{ type: "spring", stiffness: 140, damping: 22 }}
      >
        {track.title}
      </motion.h2>
      <motion.p
        data-fit=""
        className="mt-[2cqh] text-[clamp(18px,2.2cqw,36px)] font-semibold text-foreground/80"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 160, damping: 24 }}
      >
        {track.artist}
      </motion.p>
      {caption && (
        <motion.p
          className="mt-6 text-base text-secondary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {caption}
        </motion.p>
      )}
    </div>
  );
}

function titleLook(palette: Palette): WordLook {
  const top = vivid(palette.accents[0], 0.8);
  const bottom = vivid(palette.accents[1], 0.64);
  return { fill: `linear-gradient(172deg, #ffffff 0%, ${top} 45%, ${bottom} 100%)`, shadow: "none", trail: top, highlight: true };
}
