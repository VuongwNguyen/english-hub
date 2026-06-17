import Link from 'next/link'

export function NavBar() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/today" className="font-semibold">
          English Daily Hub
        </Link>

        <div className="flex gap-4 text-sm text-slate-300">
          <Link href="/today">Today</Link>
          <Link href="/stats">Stats</Link>
          <Link href="/history">History</Link>
        </div>
      </nav>
    </header>
  )
}
