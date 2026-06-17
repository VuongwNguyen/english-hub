import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-20">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
          English Daily Hub
        </p>

        <h1 className="text-4xl font-bold tracking-tight">
          Learn English without the angry owl.
        </h1>

        <p className="text-lg text-slate-300">
          A calm daily English routine for busy developers. No toxic streaks.
          No guilt. Just small progress.
        </p>

        <Link
          href="/today"
          className="w-fit rounded-2xl bg-slate-50 px-5 py-3 font-medium text-slate-950"
        >
          Open today&apos;s lesson
        </Link>
      </section>
    </main>
  )
}
