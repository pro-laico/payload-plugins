import { ResponsiveImage } from '@pro-laico/payload-images/components/image'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { MuxVideo } from '@/components/MuxVideo'
import { ButtonLink } from '@/components/ui/Button'
import { getImage, getMuxVideo, getProjectBySlug, getService } from '@/lib/data'
import { firstPlayback } from '@/lib/types'

// Atomic composition: the project is fetched depth 0, so the cover, gallery photos, video, and
// related services are IDS — each renders through its own id-keyed cached entry. Editing a
// gallery photo's alt or crop re-materializes exactly that image's entry; the project entry
// (holding just the id) survives untouched.

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const project = await getProjectBySlug(slug)
  return { title: project?.title ?? 'Project', description: project?.summary ?? undefined }
}

// Params are request data → the detail renders inside a Suspense boundary.
export default function ProjectPage({ params }: Params) {
  return (
    <Suspense fallback={null}>
      <ProjectDetail params={params} />
    </Suspense>
  )
}

async function ProjectDetail({ params }: Params) {
  const { slug } = await params
  const project = await getProjectBySlug(slug)
  if (!project) notFound()

  const [cover, videoDoc, gallery, services] = await Promise.all([
    project.coverImage != null ? getImage(project.coverImage) : null,
    project.video != null ? getMuxVideo(project.video) : null,
    Promise.all((project.gallery ?? []).map((g) => getImage(g.image))).then((docs) => docs.filter((d) => d !== null)),
    Promise.all((project.services ?? []).map((id) => getService(id))).then((docs) => docs.filter((d) => d !== null)),
  ])
  const video = firstPlayback(videoDoc)
  const meta = [project.client, project.location, project.year].filter(Boolean).join(' · ')

  return (
    <article>
      {/* Cover */}
      <div className="relative h-[62vh] min-h-[420px] w-full overflow-hidden bg-muted">
        {cover ? <ResponsiveImage image={cover} fill sizes="100vw" quality={86} className="object-cover" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-5xl px-6 pb-12">
            <Link href="/work" className="font-mono text-xs uppercase tracking-wider text-white/75 hover:text-white">
              ← Work
            </Link>
            <h1 className="mt-3 font-display text-4xl leading-tight text-white sm:text-6xl">{project.title}</h1>
            {meta ? <p className="mt-3 font-mono text-xs text-white/80">{meta}</p> : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Intro + services */}
        <div className="grid gap-10 lg:grid-cols-[1fr_260px]">
          <div>
            {project.summary ? <p className="font-serif text-2xl leading-snug tracking-tight text-foreground">{project.summary}</p> : null}
            {project.description ? (
              <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{project.description}</p>
            ) : null}
          </div>
          {services.length > 0 ? (
            <aside className="lg:pt-1">
              <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Services</div>
              <ul className="mt-3 space-y-2">
                {services.map((s) => (
                  <li key={String(s.id)}>
                    <Link href="/services" className="text-sm text-foreground hover:text-primary">
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>

        {/* Video (only with an ingested Mux clip) */}
        {video ? (
          <div className="mt-14">
            <MuxVideo playback={video} title={project.title} />
          </div>
        ) : null}

        {/* Gallery */}
        {gallery.length > 0 ? (
          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {gallery.map((img, i) => (
              <div
                key={String(img.id)}
                className={`overflow-hidden rounded-2xl border border-border ${i === 0 && gallery.length > 1 ? 'sm:col-span-2' : ''}`}
              >
                <ResponsiveImage
                  image={img}
                  aspectRatio={i === 0 && gallery.length > 1 ? '16:9' : '4:3'}
                  sizes="(max-width: 640px) 100vw, 900px"
                  quality={80}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-16 flex justify-center border-t border-border pt-12">
          <ButtonLink href="/contact" size="lg" arrow>
            Start a project like this
          </ButtonLink>
        </div>
      </div>
    </article>
  )
}
