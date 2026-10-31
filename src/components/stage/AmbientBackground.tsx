"use client";

import type { Palette } from "@/lib/theme/palette";

/** Apple Music-style moving gradient made from the album art's colors. */
export function AmbientBackground({ palette, artwork }: { palette: Palette; artwork?: string }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden" style={{ background: palette.base, transition: "background 1.2s ease" }}>
      {artwork && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={artwork}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-[-20%] h-[140%] w-[140%] object-cover opacity-35 blur-[90px] saturate-150"
        />
      )}
      {palette.accents.map((c, i) => (
        <div
          key={i}
          className={`ambient-blob ambient-blob-${i}`}
          style={{ background: `radial-gradient(circle, ${c} 0%, transparent 65%)` }}
        />
      ))}
      {/* keep text readable over bright art */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
