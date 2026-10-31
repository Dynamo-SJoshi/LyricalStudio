export default function Home() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 20% 30%, var(--art-primary), transparent 50%), radial-gradient(circle at 80% 70%, var(--art-secondary), transparent 50%), radial-gradient(circle at 50% 50%, var(--art-tertiary), transparent 60%)",
        }}
      />
      <div className="relative text-center">
        <h1 className="text-7xl font-black tracking-tight">LyricalStudio</h1>
        <p className="mt-4 text-xl text-secondary">
          Lyrics, in motion. Player coming soon.
        </p>
      </div>
    </main>
  );
}
