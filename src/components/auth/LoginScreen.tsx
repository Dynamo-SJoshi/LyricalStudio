"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { getSupabase } from "@/lib/supabase/client";
import { fallbackPalette } from "@/lib/theme/palette";
import { AmbientBackground } from "@/components/stage/AmbientBackground";

/** Shown when Supabase is configured and nobody is signed in. */
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const oauth = async (provider: "google" | "github") => {
    setError(null);
    const { error } = await getSupabase()!.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  };

  const magicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase()!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <main className="relative flex flex-1 items-center justify-center p-6">
      <AmbientBackground palette={fallbackPalette(4)} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 26 }}
        className="glass relative w-full max-w-sm rounded-[32px] p-8 shadow-2xl"
      >
        <h1 className="text-4xl font-black tracking-tight">LyricalStudio</h1>
        <p className="mt-2 text-secondary">Lyrics, in motion. Sign in to start listening.</p>

        <div className="mt-8 flex flex-col gap-3">
          <button onClick={() => oauth("google")} className="h-12 rounded-full bg-foreground font-semibold text-black transition active:scale-[0.98]">
            Continue with Google
          </button>
          <button onClick={() => oauth("github")} className="h-12 rounded-full border border-white/20 bg-white/5 font-semibold transition hover:bg-white/10 active:scale-[0.98]">
            Continue with GitHub
          </button>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-secondary">
          <span className="h-px flex-1 bg-white/15" /> or <span className="h-px flex-1 bg-white/15" />
        </div>

        {sent ? (
          <p className="text-center text-sm">Check your inbox: we sent a sign-in link to {email}.</p>
        ) : (
          <form onSubmit={magicLink} className="flex flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email"
              className="h-12 rounded-2xl border border-white/15 bg-white/5 px-4 outline-none focus:border-[var(--system-blue)]"
            />
            <button disabled={busy} className="h-12 rounded-full bg-[var(--system-blue)] font-semibold transition active:scale-[0.98] disabled:opacity-50">
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}
        {error && <p className="mt-4 text-sm text-[var(--system-red)]">{error}</p>}
        <p className="mt-6 text-center text-xs text-secondary">
          By continuing you agree to the{" "}
          <a href="/privacy" className="underline hover:text-foreground">
            terms and privacy policy
          </a>
          .
        </p>
      </motion.div>
    </main>
  );
}
