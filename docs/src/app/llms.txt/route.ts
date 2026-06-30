import { appName } from '@/lib/shared'
import { source } from '@/lib/source'

// The llms.txt index: a flat list of every doc, linking to its clean-markdown (.md) version.
export const revalidate = false

export function GET() {
  const lines = [`# ${appName}`, '', '## Docs', '']
  for (const page of source.getPages()) {
    const desc = page.data.description ? `: ${page.data.description}` : ''
    lines.push(`- [${page.data.title}](${page.url}.md)${desc}`)
  }
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
