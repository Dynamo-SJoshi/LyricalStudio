"use client";

import { useCallback, useEffect, useState } from "react";

/** Toggles browser full screen for the whole site (also on the F key). */
export function FullscreenButton() {
  const [on, setOn] = useState(false);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onChange = () => setOn(!!document.fullscreenElement);
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable) return;
      if ((e.key === "f" || e.key === "F") && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [toggle]);

  return (
    <button
      onClick={toggle}
      aria-label={on ? "Exit full screen" : "Full screen"}
      title={on ? "Exit full screen (F)" : "Full screen (F)"}
      className="glass flex size-10 items-center justify-center rounded-full transition hover:scale-105 active:scale-95"
    >
      {on ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      )}
    </button>
  );
}
