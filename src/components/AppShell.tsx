import { NavBar } from './NavBar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <NavBar />

      <section className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </section>
    </main>
  )
}
