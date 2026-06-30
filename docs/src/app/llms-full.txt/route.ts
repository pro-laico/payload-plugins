import { getLLMText } from '@/lib/get-llm-text'
import { source } from '@/lib/source'

// llms-full.txt: every doc, cleaned to plain markdown, concatenated into one file.
export const revalidate = false

export async function GET() {
  const pages = await Promise.all(source.getPages().map(getLLMText))
  return new Response(pages.join('\n\n---\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
