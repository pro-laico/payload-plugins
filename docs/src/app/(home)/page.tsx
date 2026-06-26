import { ArrowRight, Blocks } from 'lucide-react'
import Link from 'next/link'
import { githubUrl } from '@/lib/shared'

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden border-b border-fd-border">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:py-32">
          <Blocks className="mb-6 size-14 text-fd-primary" />
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Payload Plugins</h1>
          <p className="mt-6 max-w-2xl text-lg text-fd-muted-foreground">
            A suite of composable Payload CMS plugins published under the <code>@pro-laico/*</code> scope. Drop the ones you need into any
            Payload + Next.js project.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-full bg-fd-primary px-6 py-2.5 font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
            >
              Get Started <ArrowRight className="size-4" />
            </Link>
            <a
              href={githubUrl}
              className="inline-flex items-center gap-2 rounded-full border border-fd-border px-6 py-2.5 font-medium transition-colors hover:bg-fd-muted"
            >
              GitHub
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-fd-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center text-sm text-fd-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <span>Built at Pro Laico</span>
          <span className="text-fd-muted-foreground/70">Not affiliated with Payload CMS in any capacity</span>
        </div>
      </footer>
    </main>
  )
}
