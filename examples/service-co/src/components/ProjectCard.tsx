import Link from 'next/link'
import { Image } from '@/components/Image'
import { getProject } from '@/lib/data'

/** A project tile for the work grid and the home page — cover photo (focal-aware crop) + meta.
 *  Takes the project's ID and self-fetches through the id-keyed getters (the atomic model): the
 *  card renders from the project's own cache entry, the cover from the image's — so editing a
 *  title re-materializes one small entry, and an alt/crop edit only the image's. */
export async function ProjectCard({ id, priority = false }: { id: string | number; priority?: boolean }) {
  const project = await getProject(id)
  if (!project) return null
  return (
    <Link href={`/work/${project.slug}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-border bg-muted">
        {project.coverImage != null ? (
          <div className="transition-transform duration-500 ease-out group-hover:scale-[1.03]">
            <Image
              id={project.coverImage}
              aspectRatio="3:2"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 560px"
              image={{ aspectRatio: '3:2', quality: priority ? 82 : 74 }}
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
