'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/today', label: 'Today' },
  { href: '/stats', label: 'Stats' },
  { href: '/history', label: 'History' },
]

export function NavBar() {
  const pathname = usePathname()

  return (
    <header className="border-b border-hairline bg-surface/80 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link
          href="/today"
          className="font-display text-lg font-medium tracking-tight text-ink"
        >
          English Daily Hub
        </Link>

        <div className="flex gap-6 text-sm text-ink-soft">
          {links.map((link) => {
            const isActive = pathname?.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative pb-1 transition-colors hover:text-ink ${
                  isActive ? 'text-ink' : ''
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-px h-px bg-gold-bright" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
