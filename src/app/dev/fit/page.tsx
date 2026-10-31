import { notFound } from "next/navigation";
import { FitHarness } from "./FitHarness";

/**
 * Development-only test page: renders every lyric line of a set of songs in every
 * layout and reports any word that would be cut off. Run with `npm run dev` and open
 * /dev/fit, or drive it from a script via window.__fit. Not available in production.
 */
export default function FitTestPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FitHarness />;
}
