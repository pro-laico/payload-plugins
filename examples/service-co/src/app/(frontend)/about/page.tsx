import { ResponsiveImage } from '@pro-laico/payload-images/components/image'
import type { Metadata } from 'next'
import { SectionHeading } from '@/components/SectionHeading'
import { getSiteSettings, getTeam } from '@/lib/data'
import { asDoc, type MediaImage } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Studio' }

export default async function AboutPage() {
  const [settings, team] = await Promise.all([getSiteSettings(), getTeam()])

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        eyebrow="Studio"
        title={settings.tagline ?? 'A small studio, seen through'}
        description={
          settings.description ??
          'Meridian is a design-build studio working across architecture, interiors, and landscape. We take on a small number of projects a year and see each one through.'
        }
      />

      <div className="mt-16">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-primary">The team</div>
        <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((member) => {
            const photo = asDoc<MediaImage>(member.photo)
            return (
              <div key={String(member.id)}>
                <div className="overflow-hidden rounded-2xl border border-border bg-muted">
                  {photo ? (
                    <ResponsiveImage image={photo} aspectRatio="1:1" sizes="(max-width: 640px) 100vw, 360px" quality={80} className="w-full" />
                  ) : (
                    <div className="aspect-square" />
                  )}
                </div>
                <h3 className="mt-4 font-serif text-xl tracking-tight text-foreground">{member.name}</h3>
                {member.role ? <p className="font-mono text-xs uppercase tracking-wider text-primary">{member.role}</p> : null}
                {member.bio ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{member.bio}</p> : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
