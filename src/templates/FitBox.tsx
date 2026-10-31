"use client";

import { useLayoutEffect, useRef } from "react";

type Insets = { x?: number; top?: number; bottom?: number };

/**
 * Guarantees lyrics stay on screen, for any song, font or window size.
 *
 * After layout (before paint), it measures every [data-fit] element's layout box
 * (offsetLeft/Top/Width/Height ignore transforms, so animations in flight don't
 * matter) and, if their union crosses the safe area, scales and shifts the content
 * back inside. Font-size estimates get most lines right; this catches the rest.
 */
export function FitBox({
  children,
  insets,
  tilt = 0,
  zoom = 1,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  /** safe-area margins as fractions of the box */
  insets?: Insets;
  /** rotation (deg) and scale the camera applies outside this box, so corners are accounted for */
  tilt?: number;
  zoom?: number;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  const mx = insets?.x ?? 0.03;
  const mt = insets?.top ?? 0.05;
  const mb = insets?.bottom ?? 0.05;

  // runs after every render: cheap (a handful of layout reads), and words may change size
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const fit = () => {
      if (disabled) {
        box.style.transform = "";
        return;
      }
      const W = box.clientWidth;
      const H = box.clientHeight;
      let l = Infinity;
      let t = Infinity;
      let r = -Infinity;
      let b = -Infinity;
      box.querySelectorAll<HTMLElement>("[data-fit]").forEach((el) => {
        let x = 0;
        let y = 0;
        let e: HTMLElement | null = el;
        while (e && e !== box) {
          x += e.offsetLeft;
          y += e.offsetTop;
          e = e.offsetParent as HTMLElement | null;
        }
        if (e !== box || !el.offsetWidth) return;
        l = Math.min(l, x);
        t = Math.min(t, y);
        r = Math.max(r, x + el.offsetWidth);
        b = Math.max(b, y + el.offsetHeight);
      });
      if (!Number.isFinite(l) || W === 0) {
        box.style.transform = "";
        return;
      }
      const left = W * mx;
      const right = W * (1 - mx);
      const top = H * mt;
      const bottom = H * (1 - mb);
      const cx = W / 2;
      const cy = H / 2;
      const a = (tilt * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);

      // The camera maps a point p to c + zoom * R(p - c). Check where the union's
      // corners actually end up on screen.
      const onScreen = (x: number, y: number) => [cx + zoom * (cos * (x - cx) - sin * (y - cy)), cy + zoom * (sin * (x - cx) + cos * (y - cy))];
      const fitsAsIs = [
        [l, t],
        [r, t],
        [l, b],
        [r, b],
      ].every(([x, y]) => {
        const [sx, sy] = onScreen(x, y);
        return sx >= left - 0.5 && sx <= right + 0.5 && sy >= top - 0.5 && sy <= bottom + 0.5;
      });
      if (fitsAsIs) {
        box.style.transform = "";
        return;
      }

      // Otherwise: center the content in the safe area and scale it so its rotated,
      // zoomed footprint fits.
      const w = r - l;
      const h = b - t;
      const ac = Math.abs(cos);
      const as = Math.abs(sin);
      const s = Math.min(
        1,
        (right - left) / (zoom * (w * ac + h * as)),
        (bottom - top) / (zoom * (w * as + h * ac)),
      );
      // the pre-camera point that the camera maps onto the safe area's center
      const ex = ((left + right) / 2 - cx) / zoom;
      const ey = ((top + bottom) / 2 - cy) / zoom;
      const px = cx + cos * ex + sin * ey;
      const py = cy - sin * ex + cos * ey;
      const dx = px - (cx + ((l + r) / 2 - cx) * s);
      const dy = py - (cy + ((t + b) / 2 - cy) * s);
      box.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
    };
    // first fit is instant (no visible overflow); later corrections ease
    box.style.transition = settled.current ? "transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)" : "none";
    fit();
    settled.current = true;
    // re-fit whenever the box or any word changes size: window resizes, and fonts that
    // finish loading after first paint (e.g. the Japanese font loads on first use)
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    box.querySelectorAll("[data-fit]").forEach((el) => ro.observe(el));
    document.fonts?.addEventListener("loadingdone", fit);
    return () => {
      ro.disconnect();
      document.fonts?.removeEventListener("loadingdone", fit);
    };
  });

  return (
    <div ref={ref} className={`absolute inset-0 flex items-center justify-center ${className}`} style={{ transformOrigin: "50% 50%" }}>
      {children}
    </div>
  );
}
