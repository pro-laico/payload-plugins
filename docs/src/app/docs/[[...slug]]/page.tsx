import { PageActions } from '@/components/ai/page-actions'
import { getMDXComponents } from '@/components/mdx'
import { appName, docsRoute } from '@/lib/shared'
import { source } from '@/lib/source'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()

  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <PageActions markdownUrl={`${page.url}.md`} />
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()

  const image = `/og${page.url.replace(docsRoute, '')}`

  return {
    title: page.data.title,
    description: page.data.description,
    // Advertise the clean-markdown version to crawlers / agents.
    alternates: { canonical: page.url, types: { 'text/markdown': `${page.url}.md` } },
    openGraph: {
      type: 'article',
      siteName: appName,
      url: page.url,
      title: page.data.title,
      description: page.data.description,
      images: [{ url: image, width: 1200, height: 630, alt: page.data.title }],
    },
    twitter: { card: 'summary_large_image', title: page.data.title, description: page.data.description, images: [image] },
  }
}
