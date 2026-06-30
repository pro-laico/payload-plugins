import { cleanMarkdownForLLM } from '@/lib/llm-markdown'
import type { source } from '@/lib/source'

/** A page rendered as clean, LLM-friendly markdown (our components stripped to plain tables/blocks). */
export async function getLLMText(page: (typeof source)['$inferPage']): Promise<string> {
  // Use the raw author source (not 'processed') — fumadocs' processed output injects heading-id
  // syntax and over-escapes emphasis. Our transform cleans the components out either way.
  const raw = await page.data.getText('raw')
  const body = await cleanMarkdownForLLM(raw)
  const desc = page.data.description ? `\n\n${page.data.description}` : ''
  return `# ${page.data.title}\n\nURL: ${page.url}${desc}\n\n${body}\n`
}
