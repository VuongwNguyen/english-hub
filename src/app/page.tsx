import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden text-ink">
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, var(--gold-soft) 0%, transparent 70%)',
        }}
      />

      <section className="relative mx-auto flex max-w-3xl flex-col gap-6 px-6 py-24">
        <p className="animate-fade-up text-sm uppercase tracking-[0.3em] text-gold">
          English Daily Hub
        </p>

        <h1 className="animate-fade-up font-display text-5xl font-medium leading-tight tracking-tight text-ink [animation-delay:80ms]">
          Learn English like watering a plant.
        </h1>

        <p className="animate-fade-up font-display text-lg italic text-ink-soft [animation-delay:160ms]">
          A calm daily English routine for busy developers. No toxic streaks.
          No guilt. Just small progress.
        </p>

        <Link
          href="/today"
          className="animate-fade-up w-fit rounded-full bg-accent px-6 py-3 font-medium text-surface shadow-lg shadow-accent/20 transition-transform hover:scale-[1.02] [animation-delay:240ms]"
        >
          Open today&apos;s lesson
        </Link>
      </section>
    </main>
  )
}
