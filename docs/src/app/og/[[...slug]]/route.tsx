import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

/** Every card prerenders at build, so the mark is read from disk once and inlined — an ImageResponse
 * can't resolve a relative URL, and at build time there's no server to fetch one from anyway. */
const mark = `data:image/png;base64,${readFileSync(join(process.cwd(), 'public/icons/icon-192.png')).toString('base64')}`

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
      {/* A hairline of colour along the top edge, so the card reads as ours even as a thumbnail. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: '#4ea9ff' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* The mark is transparent, so it composites straight onto the card — no plate behind it. */}
        {/* biome-ignore lint/performance/noImgElement: ImageResponse renders through Satori, which knows <img> and nothing about next/image */}
        <img src={mark} width={56} height={56} alt="" />
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 1, textTransform: 'uppercase', color: '#4ea9ff' }}>{section}</div>
      </div>

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
