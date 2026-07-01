import type { Metadata } from 'next'
import { ProjectCard } from '@/components/ProjectCard'
import { SectionHeading } from '@/components/SectionHeading'
import { getProjects } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Work' }

export default async function WorkPage() {
  const projects = await getProjects()

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        eyebrow="Work"
        title="Selected projects"
        description="A few of the buildings, interiors, and landscapes we’ve designed and built. Each one was a design-build engagement from first sketch to final detail."
      />
      {projects.length === 0 ? (
        <p className="mt-12 text-muted-foreground">
          No projects yet — open <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">/admin</code>, click{' '}
          <strong>Seed your database</strong>, then reload.
        </p>
      ) : (
        <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2">
          {projects.map((p, i) => (
            <ProjectCard key={String(p.id)} project={p} priority={i < 2} />
          ))}
        </div>
      )}
    </div>
  )
}
