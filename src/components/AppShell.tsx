import { NavBar } from './NavBar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen text-ink">
      <NavBar />

      <section className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </section>
    </main>
  )
}
