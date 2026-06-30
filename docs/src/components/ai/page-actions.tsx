'use client'

import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'

/**
 * A small "this page is available to AI" bar shown at the top of every docs page. Lets a reader
 * grab the clean-markdown version (the `.md` route built by src/lib/llm-markdown.ts) or hand it
 * straight to an assistant. Purely additive — it doesn't change the rendered page.
 */
const btn =
  'inline-flex items-center gap-1.5 rounded-md border border-fd-border px-2.5 py-1 font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground'

export function PageActions({ markdownUrl }: { markdownUrl: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      const text = await (await fetch(markdownUrl)).text()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard/fetch can fail (permissions, offline) — fall back to opening the markdown.
      window.open(markdownUrl, '_blank')
    }
  }

  const ask = (base: string) => () => {
    const url = typeof window === 'undefined' ? markdownUrl : new URL(markdownUrl, location.origin).href
    const prompt = `Read ${url} — it's the markdown documentation for this page — then help me use it.`
    window.open(`${base}${encodeURIComponent(prompt)}`, '_blank')
  }

  return (
    <div className="not-prose mb-6 flex flex-wrap items-center gap-2 border-b border-fd-border pb-4 text-xs">
      <span className="text-fd-muted-foreground">For AI / LLMs:</span>
      <button type="button" onClick={copy} className={btn}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Copied' : 'Copy as Markdown'}
      </button>
      <a href={markdownUrl} target="_blank" rel="noreferrer" className={btn}>
        <ExternalLink className="size-3.5" /> View Markdown
      </a>
      <button type="button" onClick={ask('https://chatgpt.com/?q=')} className={btn}>
        Open in ChatGPT
      </button>
      <button type="button" onClick={ask('https://claude.ai/new?q=')} className={btn}>
        Open in Claude
      </button>
    </div>
  )
}
