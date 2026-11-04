import { useId } from "react";

/**
 * The LyricalStudio mark: a white "l" and a yellow "y" caught mid-entrance (tilted and
 * lifted, like a lyric word landing), on a dark rounded tile. Drawn on a 512 grid; the
 * source and the 16 px favicon cut live in the Figma file "LyricalStudio — Logo".
 * Inline SVG so it stays sharp at any size.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  // unique gradient id: several marks can be on one page
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id={id} x1="256" y1="0" x2="256" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1C1C22" />
          <stop offset="1" stopColor="#08080A" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="115" fill={`url(#${id})`} />
      <rect x="1.5" y="1.5" width="509" height="509" rx="113.5" stroke="#FFFFFF" strokeOpacity="0.09" strokeWidth="3" />
      <path d="M135 108V388" stroke="#FFFFFF" strokeWidth="58" strokeLinecap="round" />
      <g transform="translate(0 -10) rotate(-8 308 315)">
        <path d="M239 214L323 330" stroke="#FFD60A" strokeWidth="58" strokeLinecap="round" />
        <path d="M377 214L283 416" stroke="#FFD60A" strokeWidth="58" strokeLinecap="round" />
      </g>
    </svg>
  );
}
