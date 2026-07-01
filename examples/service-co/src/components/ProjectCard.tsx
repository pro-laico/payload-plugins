import { ResponsiveImage } from '@pro-laico/payload-images/components/image'
import Link from 'next/link'
import { asDoc, type MediaImage, type Project } from '@/lib/types'

/** A project tile for the work grid and the home page — cover photo (focal-aware crop) + meta. */
export function ProjectCard({ project, priority = false }: { project: Project; priority?: boolean }) {
  const cover = asDoc<MediaImage>(project.coverImage)
  return (
    <Link href={`/work/${project.slug}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-border bg-muted">
        {cover ? (
          <div className="transition-transform duration-500 ease-out group-hover:scale-[1.03]">
            <ResponsiveImage
              image={cover}
              aspectRatio="3:2"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 560px"
              quality={priority ? 82 : 74}
              className="block w-full"
            />
          </div>
        ) : (
          <div className="aspect-[3/2]" />
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <h3 className="font-serif text-xl tracking-tight text-foreground group-hover:text-primary">{project.title}</h3>
        {project.year ? <span className="font-mono text-xs text-muted-foreground">{project.year}</span> : null}
      </div>
      {project.summary ? <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{project.summary}</p> : null}
    </Link>
  )
}
