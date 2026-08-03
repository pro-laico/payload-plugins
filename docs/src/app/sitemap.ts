import type { MetadataRoute } from 'next'
import { docsRoute, siteUrl } from '@/lib/shared'
import { source } from '@/lib/source'

/** Built from the same source the pages are, so a new doc is listed the moment it exists. */
export default function sitemap(): MetadataRoute.Sitemap {
  const absolute = (path: string) => new URL(path, siteUrl).toString()

  return [
    { url: absolute('/'), changeFrequency: 'weekly', priority: 1 },
    ...source.getPages().map((page) => ({
      url: absolute(page.url),
      changeFrequency: 'weekly' as const,
      // The section landing pages are the entry points; everything below them is equal.
      priority: page.url === docsRoute || page.slugs.length <= 2 ? 0.8 : 0.5,
    })),
  ]
}
