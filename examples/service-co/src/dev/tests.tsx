import Link from 'next/link'
import { defineTest } from '@pro-laico/payload-dev-tools/toolbar'
import { ButtonLink } from '@/components/ui/Button'
import { getSiteSettings } from '@/lib/data'

// The dev-toolbar test harness for service-co: two alternate homepage-hero concepts (each is its
// own page at /dev/tests/hero, version toggled from the toolbar), plus header/footer OVERRIDES —
// picking one in the toolbar's Tests view swaps it into the real layout site-wide (via
// resolveDevChrome in layout.tsx) until you hit Real.

const Bold = async () => {
  const settings = await getSiteSettings()
  return (
    <section className="flex min-h-screen items-center bg-neutral-950 text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-24">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/60">Concept — Bold</p>
        <h1 className="mt-6 max-w-4xl font-display text-5xl leading-[1.02] sm:text-7xl">
          {settings.tagline ?? 'We design and build places worth staying in.'}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/70">One dark canvas, one statement, one decisive call to action.</p>
        <div className="mt-10">
          <ButtonLink href="/contact" size="lg" arrow>
            Start a project
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}

const Split = () => (
  <section className="grid min-h-screen lg:grid-cols-2">
    <div className="flex items-center bg-background">
      <div className="w-full px-6 py-24 lg:pl-16 lg:pr-12">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Concept — Split</p>
        <h1 className="mt-6 font-display text-4xl leading-[1.05] text-foreground sm:text-6xl">Clear value, left. Proof, right.</h1>
        <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
          A two-column hero pairing the pitch with a full-height project photo instead of a background image.
        </p>
        <div className="mt-8">
          <ButtonLink href="/work" size="lg" arrow>
            View our work
          </ButtonLink>
        </div>
      </div>
    </div>
    <div className="hidden bg-gradient-to-br from-neutral-300 to-neutral-500 lg:block" />
  </section>
)

export const heroTest = defineTest({
  key: 'hero',
  label: 'Homepage hero',
  kind: 'page',
  versions: [
    { id: 'bold', label: 'Bold', render: Bold },
    { id: 'split', label: 'Split', render: Split },
  ],
})

const NAV = [
  { href: '/work', label: 'Work' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'Studio' },
  { href: '/contact', label: 'Contact' },
]

// A centered-nav header concept: brand on top, nav beneath, solid background — compare against
// the real sticky glass header on any page.
const CenteredHeader = async () => {
  const settings = await getSiteSettings()
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-5">
        <Link href="/" className="font-display text-3xl leading-none tracking-tight text-foreground">
          {settings.companyName ?? 'Meridian'}
        </Link>
        <nav className="flex items-center gap-8 text-sm">
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

// An inverted header concept: dark bar, uppercase mono nav.
const InkHeader = async () => {
  const settings = await getSiteSettings()
  return (
    <header className="sticky top-0 z-40 bg-neutral-950 text-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-display text-xl leading-none tracking-tight">
          {settings.companyName ?? 'Meridian'}
        </Link>
        <nav className="flex items-center gap-6 font-mono text-xs uppercase tracking-widest">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-white/60 transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

export const headerTest = defineTest({
  key: 'site-header',
  label: 'Site header',
  kind: 'header',
  versions: [
    { id: 'centered', label: 'Centered', render: CenteredHeader },
    { id: 'ink', label: 'Ink', render: InkHeader },
  ],
})

// A compact one-line footer concept — versus the real four-column footer.
const CompactFooter = async () => {
  const settings = await getSiteSettings()
  return (
    <footer className="mt-24 border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm">
        <span className="font-display text-lg tracking-tight">{settings.companyName ?? 'Meridian'}</span>
        <nav className="flex items-center gap-6">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="text-xs text-muted-foreground">© {settings.companyName ?? 'Meridian'}</span>
      </div>
    </footer>
  )
}

export const footerTest = defineTest({
  key: 'site-footer',
  label: 'Site footer',
  kind: 'footer',
  versions: [{ id: 'compact', label: 'Compact', render: CompactFooter }],
})

export const devTests = [heroTest, headerTest, footerTest]
