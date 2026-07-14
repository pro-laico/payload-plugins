import { Suspense } from 'react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getProjectIds } from '@/lib/data'
import { ProjectCard } from '@/components/ProjectCard'
import { SectionHeading } from '@/components/SectionHeading'

export const metadata: Metadata = { title: 'Work' }

export default function WorkPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        eyebrow="Work"
        title="Selected projects"
        description="A few of the buildings, interiors, and landscapes we’ve designed and built. Each one was a design-build engagement from first sketch to final detail."
      />
      <Suspense fallback={null}>
        <WorkGrid />
      </Suspense>
    </div>
  )
}

async function WorkGrid() {
  await connection()
  const projectIds = await getProjectIds()

  return projectIds.length === 0 ? (
    <p className="mt-12 text-muted-foreground">
      No projects yet — open <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">/admin</code>, click{' '}
      <strong>Seed your database</strong>, then reload.
    </p>
  ) : (
    <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2">
      {projectIds.map((id, i) => (
        <ProjectCard key={String(id)} id={id} priority={i < 2} />
      ))}
    </div>
  )
}
