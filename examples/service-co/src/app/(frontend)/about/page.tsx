import { Suspense } from 'react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { ImageFor } from '@/components/ImageFor'
import { SectionHeading } from '@/components/SectionHeading'
import { getSiteSettings, getTeamIds, getTeamMember } from '@/lib/data'

export const metadata: Metadata = { title: 'Studio' }

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <Suspense fallback={null}>
        <AboutContent />
      </Suspense>
    </div>
  )
}

async function AboutContent() {
  await connection()
  const [settings, teamIds] = await Promise.all([getSiteSettings(), getTeamIds()])

  return (
    <>
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
          {teamIds.map((id) => (
            <TeamCard key={String(id)} id={id} />
          ))}
        </div>
      </div>
    </>
  )
}

/** One member = one cache entry; the portrait renders from the image doc's own entry. */
async function TeamCard({ id }: { id: string | number }) {
  const member = await getTeamMember(id)
  if (!member) return null
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-border bg-muted">
        {member.photo != null ? (
          <ImageFor
            id={member.photo}
            aspectRatio="1:1"
            sizes="(max-width: 640px) 100vw, 360px"
            image={{ aspectRatio: '1:1', quality: 80 }}
            className="w-full"
          />
        ) : (
          <div className="aspect-square" />
        )}
      </div>
      <h3 className="mt-4 font-serif text-xl tracking-tight text-foreground">{member.name}</h3>
      {member.role ? <p className="font-mono text-xs uppercase tracking-wider text-primary">{member.role}</p> : null}
      {member.bio ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{member.bio}</p> : null}
    </div>
  )
}
