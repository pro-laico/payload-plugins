import Link from 'next/link'
import { getSiteSettings } from '@/lib/data'

const NAV = [
  { href: '/work', label: 'Work' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'Studio' },
  { href: '/contact', label: 'Contact' },
]

/** The site header — a server component that reads the brand name from SiteSettings. */
export async function SiteHeader() {
  const settings = await getSiteSettings()
  const name = settings.companyName ?? 'Meridian'

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-display text-2xl leading-none tracking-tight text-foreground">
          {name}
        </Link>
        <nav className="flex items-center gap-7 text-sm">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
