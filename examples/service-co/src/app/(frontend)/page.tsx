import { connection } from 'next/server'
import { Suspense } from 'react'
import { Image } from '@/components/Image'
import { MuxVideo } from '@/components/MuxVideo'
import { ProjectCard } from '@/components/ProjectCard'
import { SectionHeading } from '@/components/SectionHeading'
import { ServiceCard } from '@/components/ServiceCard'
import { ButtonLink } from '@/components/ui/Button'
import {
  getFeaturedProjectId,
  getMuxVideo,
  getProject,
  getProjectIds,
  getServiceIds,
  getSiteSettings,
  getTestimonial,
  getTestimonialIds,
} from '@/lib/data'
import { firstPlayback } from '@/lib/mux'

// Cache Components: the page composes at request time from the atomic cache entries the getters
// materialize — a seed or an admin edit busts exactly the entries it touches, and the next
// request recomposes from what survived.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  )
}

async function HomeContent() {
  await connection()
  const [settings, serviceIds, projectIds, featuredId, testimonialIds] = await Promise.all([
    getSiteSettings(),
    getServiceIds(),
    getProjectIds(),
    getFeaturedProjectId(),
    getTestimonialIds(),
  ])

  // Each reference resolves through its own id-keyed entry — the settings entry holds only ids.
  const [featured, showreelDoc] = await Promise.all([
    featuredId != null ? getProject(featuredId) : null,
    settings.showreel != null ? getMuxVideo(settings.showreel) : null,
  ])
  const showreel = firstPlayback(showreelDoc)
  const others = projectIds.filter((id) => id !== featuredId).slice(0, 4)
  const name = settings.companyName ?? 'Meridian'

  return (
    <>
      {/* Hero — a full-bleed payload-images crop (object-fit fill) under an editorial overlay. */}
      <section className="relative h-[80vh] min-h-[540px] w-full overflow-hidden bg-muted">
        {settings.heroImage != null ? (
          <Image id={settings.heroImage} fill sizes="100vw" image={{ quality: 86 }} blur={{ quality: 'md' }} className="object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-6 pb-16">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/75">Design-build studio</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] text-white sm:text-6xl">
              {settings.tagline ?? 'We design and build places worth staying in.'}
            </h1>
            {settings.description ? <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85">{settings.description}</p> : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/work" size="lg" arrow>
                View our work
              </ButtonLink>
              <ButtonLink href="/contact" size="lg" variant="outline" className="border-white/35 text-white hover:bg-white/10">
                Start a project
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="What we do"
          title="Four disciplines, one team"
          description="We design the building, the interiors, and the ground it sits on together — so the result reads as a single idea, not a set of handoffs."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {serviceIds.map((id) => (
            <ServiceCard key={String(id)} id={id} />
          ))}
        </div>
      </section>

      {/* Featured project — a large two-column feature */}
      {featured ? (
        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-border">
              {featured?.coverImage != null ? (
                <Image
                  id={featured.coverImage}
                  aspectRatio="4:3"
                  sizes="(max-width: 1024px) 100vw, 560px"
                  image={{ aspectRatio: '4:3', quality: 82 }}
                  className="w-full"
                />
              ) : null}
            </div>
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Featured project</div>
              <h2 className="mt-3 font-serif text-3xl tracking-tight text-foreground sm:text-4xl">{featured.title}</h2>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {[featured.client, featured.location, featured.year].filter(Boolean).join(' · ')}
              </p>
              {featured.summary ? <p className="mt-5 text-base leading-relaxed text-muted-foreground">{featured.summary}</p> : null}
              <div className="mt-7">
                <ButtonLink href={`/work/${featured.slug}`} arrow>
                  See the project
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Selected work */}
      {others.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex items-end justify-between gap-6">
            <SectionHeading eyebrow="Selected work" title="Recent projects" />
            <ButtonLink href="/work" variant="ghost" size="sm" arrow className="hidden sm:inline-flex">
              All work
            </ButtonLink>
          </div>
          <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2">
            {others.map((id) => (
              <ProjectCard key={String(id)} id={id} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Showreel — only when a Mux clip is ingested (credentials present) */}
      {showreel ? (
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <SectionHeading eyebrow="In motion" title="Studio showreel" className="mb-8" />
            <MuxVideo playback={showreel} title={`${name} — Showreel`} />
          </div>
        </section>
      ) : null}

      {/* Testimonials */}
      {testimonialIds.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeading eyebrow="Clients" title="In their words" align="center" className="mb-12" />
          <div className="grid gap-6 md:grid-cols-3">
            {testimonialIds.map((id) => (
              <TestimonialCard key={String(id)} id={id} />
            ))}
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground sm:px-16">
          <h2 className="mx-auto max-w-2xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            Have a site, a building, or a room that isn’t working yet?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
            We take on a handful of projects a year. Tell us about yours and we’ll tell you honestly whether we’re the right studio for it.
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href="/contact" size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
              Start a conversation
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  )
}

/** One testimonial = one cache entry — editing a quote re-renders one card, not the row. */
async function TestimonialCard({ id }: { id: string | number }) {
  const t = await getTestimonial(id)
  if (!t) return null
  return (
    <figure className="flex flex-col rounded-2xl border border-border bg-card p-7">
      <blockquote className="font-serif text-lg leading-relaxed text-foreground">“{t.quote}”</blockquote>
      <figcaption className="mt-6 text-sm">
        <div className="font-medium text-foreground">{t.author}</div>
        {t.company ? <div className="text-muted-foreground">{t.company}</div> : null}
      </figcaption>
    </figure>
  )
}
