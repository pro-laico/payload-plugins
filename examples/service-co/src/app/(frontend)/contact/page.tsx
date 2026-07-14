import { Suspense } from 'react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getSiteSettings } from '@/lib/data'
import { CmsIcon } from '@/components/ui/CmsIcon'
import { ButtonLink } from '@/components/ui/Button'
import { SectionHeading } from '@/components/SectionHeading'

export const metadata: Metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <SectionHeading
        eyebrow="Contact"
        title="Let’s talk about your project"
        description="Send a note with a sentence or two about what you’re planning, roughly where it is, and your timeline. We read every one."
      />
      <Suspense fallback={null}>
        <ContactDetails />
      </Suspense>
    </div>
  )
}

async function ContactDetails() {
  await connection()
  const settings = await getSiteSettings()
  const c = settings.contact ?? {}

  const rows = [
    c.email ? { icon: 'mail', label: c.email, href: `mailto:${c.email}` } : null,
    c.phone ? { icon: 'phone', label: c.phone, href: `tel:${c.phone.replace(/[^+\d]/g, '')}` } : null,
    c.address ? { icon: 'map-pin', label: c.address, href: undefined } : null,
  ].filter(Boolean) as { icon: string; label: string; href?: string }[] //TODO: replace `as` cast with proper typing

  return (
    <>
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
    </>
  )
}
