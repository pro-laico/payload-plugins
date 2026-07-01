import type { Metadata } from 'next'
import { SectionHeading } from '@/components/SectionHeading'
import { ButtonLink } from '@/components/ui/Button'
import { CmsIcon } from '@/components/ui/CmsIcon'
import { getSiteSettings } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Contact' }

export default async function ContactPage() {
  const settings = await getSiteSettings()
  const c = settings.contact ?? {}

  const rows = [
    c.email ? { icon: 'mail', label: c.email, href: `mailto:${c.email}` } : null,
    c.phone ? { icon: 'phone', label: c.phone, href: `tel:${c.phone.replace(/[^+\d]/g, '')}` } : null,
    c.address ? { icon: 'map-pin', label: c.address, href: undefined } : null,
  ].filter(Boolean) as { icon: string; label: string; href?: string }[]

  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <SectionHeading
        eyebrow="Contact"
        title="Let’s talk about your project"
        description="Send a note with a sentence or two about what you’re planning, roughly where it is, and your timeline. We read every one."
      />

      <div className="mt-12 divide-y divide-border rounded-2xl border border-border bg-card">
        {rows.map((row) => (
          <a
            key={row.icon}
            href={row.href ?? undefined}
            className={`flex items-center gap-4 px-6 py-5 ${row.href ? 'transition-colors hover:bg-muted' : 'cursor-default'}`}
          >
            <CmsIcon name={row.icon} variant="outline" size="base" className="text-primary" />
            <span className="text-foreground">{row.label}</span>
          </a>
        ))}
      </div>

      <div className="mt-10">
        <ButtonLink href={c.email ? `mailto:${c.email}` : '/'} size="lg" arrow>
          Email the studio
        </ButtonLink>
      </div>
    </div>
  )
}
