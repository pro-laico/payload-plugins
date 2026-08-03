import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import { appDescription, appName } from '@/lib/shared'
import { source } from '@/lib/source'

/**
 * The link preview card, drawn per page.
 *
 * Fumadocs dropped `createMetadataImage` in v16, so this renders the card itself: the page's own
 * title and description, plus the section it belongs to. Deriving it from page data rather than
 * shipping image files means a new page is previewable the moment it exists, and a retitled one
 * never goes stale.
 */
export const dynamic = 'force-static'

/** Trims to a word so a card never ends mid-word; the ellipsis says the sentence continues. */
const summarize = (text: string, max = 150): string => {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`
}

export async function generateStaticParams() {
  return source.generateParams().map(({ slug }) => ({ slug }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params
  // No slug is the site root's card, which the home page points at. Naming it after the docs index
  // ("Overview") would be wrong for a link to the site itself.
  const page = slug?.length ? source.getPage(slug) : undefined
  if (slug?.length && !page) notFound()

  const title = page?.data.title ?? appName
  const description = page?.data.description ?? appDescription
  // `plugins/payload-images/caching` → "payload-images", the eyebrow above the title. On a plugin's
  // own landing page that would just restate the title, so fall back to the site name there.
  const plugin = slug?.[0] === 'plugins' && slug[1] ? slug[1] : undefined
  const section = plugin && plugin.toLowerCase() !== title.toLowerCase() ? plugin : appName

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        background: '#0a0a0a',
        color: '#fafafa',
        fontFamily: 'sans-serif',
      }}
    >
      {/* A hairline of colour along the top edge — enough to be recognisable in a feed without
          inventing a logo the site doesn't have. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: '#4ea9ff' }} />

      <div style={{ display: 'flex', fontSize: 26, letterSpacing: 1, textTransform: 'uppercase', color: '#4ea9ff' }}>{section}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>{title}</div>
        {description ? <div style={{ display: 'flex', fontSize: 30, lineHeight: 1.4, color: '#a1a1a1' }}>{summarize(description)}</div> : null}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: '#a1a1a1' }}>
        <div style={{ display: 'flex' }}>{appName}</div>
        <div style={{ display: 'flex' }}>@pro-laico</div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  )
}
