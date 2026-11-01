import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy & terms · LyricalStudio",
  description: "What LyricalStudio stores, which services it talks to, and the terms for using it.",
};

const REPO = "https://github.com/arijit-debug/LyricalStudio-Web";
const UPDATED = "November 1, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16 leading-relaxed">
      <Link href="/" className="text-sm text-[var(--system-blue)] hover:underline">
        ← Back to LyricalStudio
      </Link>
      <h1 className="mt-6 text-4xl font-black tracking-tight">Privacy &amp; terms</h1>
      <p className="mt-2 text-sm text-secondary">Last updated {UPDATED}</p>

      <Section title="In short">
        <p>
          LyricalStudio is a free, open-source hobby project. It has no ads, doesn&apos;t sell or share your data, and
          keeps as little as it can. There are no accounts: everything you do stays in your browser. Music plays through
          YouTube&apos;s official embedded player; LyricalStudio never downloads or hosts audio.
        </p>
      </Section>

      <Section title="What's stored">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <b>In your browser only</b> (never sent to us): recently played songs, liked songs, cached lyrics, per-song
            lyric timing adjustments, and your layout and volume settings. Clearing your browser&apos;s site data
            removes them.
          </li>
          <li>
            <b>Server logs:</b> our hosting provider keeps short-lived request logs (including IP addresses) for
            security and rate limiting.
          </li>
        </ul>
      </Section>

      <Section title="Services LyricalStudio uses">
        <p>
          LyricalStudio uses YouTube API Services. By using it you agree to the{" "}
          <A href="https://www.youtube.com/t/terms">YouTube Terms of Service</A>, and Google handles data from the
          embedded player under the <A href="https://policies.google.com/privacy">Google Privacy Policy</A>. YouTube may
          set cookies in the player. You can revoke access through{" "}
          <A href="https://security.google.com/settings/security/permissions">Google&apos;s security settings</A>,
          although LyricalStudio never asks for access to your YouTube account.
        </p>
        <p className="mt-3">
          To find lyrics, artwork and genre, our server sends the song&apos;s title, artist, album and length (never
          anything about you) to <A href="https://lrcmux.dev">lrcmux</A>, <A href="https://lrclib.net">LRCLIB</A>,{" "}
          <A href="https://lyricsovh.docs.apiary.io">lyrics.ovh</A> and the{" "}
          <A href="https://performance-partners.apple.com/search-api">iTunes Search API</A>.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p>Everything kept in your browser goes away when you clear this site&apos;s data in your browser settings.</p>
      </Section>

      <Section title="Terms">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            LyricalStudio is provided as is, without warranty, under the{" "}
            <A href={`${REPO}/blob/main/LICENSE`}>MIT License</A>. It may change or go offline at any time.
          </li>
          <li>
            Songs, videos, artwork and lyrics belong to their owners. Lyrics come from community and third-party
            services and may be inaccurate.
          </li>
          <li>
            If you own content shown here and want it removed, <A href={`${REPO}/issues/new`}>open an issue</A> and
            we&apos;ll take it down promptly.
          </li>
          <li>Don&apos;t use LyricalStudio to scrape, overload or abuse it or the services it relies on.</li>
          <li>LyricalStudio isn&apos;t affiliated with YouTube, Google, Apple or Cotodama.</li>
        </ul>
      </Section>

      <Section title="Changes">
        <p>
          When this page changes, the date at the top changes too. The full history is in the{" "}
          <A href={`${REPO}/commits/main/src/app/privacy/page.tsx`}>public repository</A>.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-[var(--system-blue)] hover:underline">
      {children}
    </a>
  );
}
