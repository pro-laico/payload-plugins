import Link from 'next/link'
import { CmsIcon } from '@/components/ui/CmsIcon'
import { getSiteSettings } from '@/lib/data'

/** The site footer — brand blurb plus CMS-managed contact details, each with a payload-icons glyph
 *  resolved by name through the active icon set (<CmsIcon name>). */
export async function SiteFooter() {
  const settings = await getSiteSettings()
  const c = settings.contact ?? {}
  const name = settings.companyName ?? 'Meridian'

  return (
    <footer className="mt-24 border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="font-display text-2xl tracking-tight">{name}</div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {settings.tagline ?? 'A design-build studio working across architecture, interiors, and landscape.'}
          </p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Contact</div>
          {c.email ? (
            <a href={`mailto:${c.email}`} className="flex items-center gap-2.5 text-foreground hover:text-primary">
              <CmsIcon name="mail" size="sm" tone="muted" />
              {c.email}
            </a>
          ) : null}
          {c.phone ? (
            <a href={`tel:${c.phone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-2.5 text-foreground hover:text-primary">
              <CmsIcon name="phone" size="sm" tone="muted" />
              {c.phone}
            </a>
          ) : null}
          {c.address ? (
            <p className="flex items-start gap-2.5 text-muted-foreground">
              <CmsIcon name="map-pin" size="sm" tone="muted" className="mt-0.5" />
              {c.address}
            </p>
          ) : null}
        </div>

        <nav className="space-y-3 text-sm">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Explore</div>
          {[
            { href: '/work', label: 'Work' },
            { href: '/services', label: 'Services' },
            { href: '/about', label: 'Studio' },
            { href: '/admin', label: 'Admin' },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="block text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-5 text-xs text-muted-foreground">
          © {name}. A demo site built on Payload CMS + the @pro-laico/* plugins. Every image, icon, and font is CMS-managed.
        </div>
      </div>
    </footer>
  )
}
