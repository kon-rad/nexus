const VIDEO_ID = "Ppo9r6Cvgkg";

export function DemoVideo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-6">
      <div className="w-full max-w-5xl">
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/40 aspect-video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0`}
            title="Nexus demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </main>
  );
}
