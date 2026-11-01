"use client";

import { useEffect, useState } from "react";

const KEY = "ls:mobile-ok";
/** narrower than this, the stage, the 200x200 video tile and the controls don't fit side by side */
const QUERY = "(max-width: 899px), (pointer: coarse) and (max-width: 1100px)";

/**
 * LyricalStudio is built for desktop. On phones and small tablets, say so up front
 * instead of showing a cramped layout, and let people carry on if they want.
 * Shown before anything plays, so it never covers the YouTube player.
 */
export function MobileNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(KEY)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(window.matchMedia(QUERY).matches);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    sessionStorage.setItem(KEY, "1");
    setShow(false);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="mobile-notice-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
      <div className="glass w-full max-w-sm rounded-[28px] p-7 text-center shadow-2xl">
        <h2 id="mobile-notice-title" className="text-2xl font-black tracking-tight">
          Best on a bigger screen
        </h2>
        <p className="mt-3 text-secondary">
          LyricalStudio&apos;s kinetic lyrics are designed for desktop and laptop browsers. Open this page on a computer
          for the full experience.
        </p>
        <button onClick={dismiss} className="mt-6 h-11 w-full rounded-full bg-white/10 font-semibold transition hover:bg-white/20 active:scale-[0.98]">
          Continue anyway
        </button>
      </div>
    </div>
  );
}
