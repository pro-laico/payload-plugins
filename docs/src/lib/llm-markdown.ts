/**
 * Cleans our custom MDX components out of a page's processed markdown so the `.md` / `llms.txt`
 * routes serve plain, LLM-friendly markdown — authors never have to think about it. It runs ONLY
 * at export time (not on the rendered page), parsing the markdown with remark-mdx and rewriting:
 *
 *   - `<ConfigOptions items={options} />` + its `export const options = [...]` → a markdown table
 *     (recursive: nested options become `parent.child` rows).
 *   - `<TypeTable type={{…}} />` → a markdown table.
 *   - `<Tabs>` / `<Tab value="…">` → each tab inlined under a bold label (so an LLM sees BOTH the
 *     Reference table and the TypeScript code, not a hidden tab).
 *   - `<Steps>` / `<Step>` / `<Cards>` → unwrapped (their markdown children kept).
 *   - `<Callout>` → a blockquote. `<Card title href>` → a markdown link.
 *
 * The inline data (`export const …`) is pure literal config, so it's evaluated with `new Function`
 * at build time on our own trusted content. Anything unrecognized is unwrapped rather than dropped.
 */
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

interface AnyNode {
  type: string
  name?: string
  value?: unknown
  children?: AnyNode[]
  attributes?: Array<{ type?: string; name?: string; value?: unknown }>
}

interface Opt {
  name?: string
  type?: string
  default?: string
  required?: boolean
  description?: string
  options?: Opt[]
}

// Evaluate a static JS expression — our docs data is pure literals (strings, template literals,
// arrays, objects). Build-time only, on our own trusted content.
function evalExpr(src?: string): unknown {
  if (src == null) return undefined
  try {
    // biome-ignore lint/security/noGlobalEval: build-time eval of our own literal doc data
    return new Function(`return (${src})`)()
  } catch {
    return undefined
  }
}

// `export const NAME = <literal>` → record NAME in scope.
function collectExports(tree: AnyNode, scope: Record<string, unknown>): void {
  for (const node of tree.children ?? []) {
    if (node.type !== 'mdxjsEsm' || typeof node.value !== 'string') continue
    const m = node.value.match(/export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/)
    if (m) scope[m[1]] = evalExpr(m[2].replace(/;\s*$/, ''))
  }
}

// A JSX attribute as a plain string (string attrs) or its expression source (`{…}` attrs).
function attrSource(node: AnyNode, name: string): string | undefined {
  const a = node.attributes?.find((x) => x?.type === 'mdxJsxAttribute' && x.name === name)
  if (!a) return undefined
  if (typeof a.value === 'string') return a.value
  return (a.value as { value?: string } | undefined)?.value
}

// Resolve an attribute to a value: an identifier looks up scope, else eval the expression.
function attrValue(node: AnyNode, name: string, scope: Record<string, unknown>): unknown {
  const src = attrSource(node, name)
  if (src == null) return undefined
  const id = src.trim()
  if (/^[A-Za-z_$][\w$]*$/.test(id) && id in scope) return scope[id]
  return evalExpr(src)
}

const cell = (s: unknown): string =>
  String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim()
const code = (s: unknown): string => (s == null || s === '' ? '' : `\`${cell(s)}\``)
const html = (value: string): AnyNode => ({ type: 'html', value })
const boldLine = (text: string): AnyNode => ({ type: 'paragraph', children: [{ type: 'strong', children: [{ type: 'text', value: text }] }] })

function configTable(items: unknown): string {
  if (!Array.isArray(items)) return ''
  const rows: string[] = []
  const walk = (arr: Opt[], prefix: string) => {
    for (const o of arr) {
      const name = prefix ? `${prefix}.${o.name}` : String(o.name ?? '')
      const desc = cell(o.description) + (o.required ? ' _(required)_' : '')
      rows.push(`| ${code(name)} | ${code(o.type)} | ${code(o.default)} | ${desc} |`)
      if (Array.isArray(o.options)) walk(o.options, name)
    }
  }
  walk(items as Opt[], '')
  return rows.length ? `| Option | Type | Default | Description |\n| --- | --- | --- | --- |\n${rows.join('\n')}` : ''
}

function typeTable(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return ''
  const rows = Object.entries(obj as Record<string, { type?: string; default?: string; description?: string }>).map(
    ([k, v]) => `| ${code(k)} | ${code(v?.type)} | ${code(v?.default)} | ${cell(v?.description)} |`,
  )
  return rows.length ? `| Name | Type | Default | Description |\n| --- | --- | --- | --- |\n${rows.join('\n')}` : ''
}

function rewrite(children: AnyNode[], scope: Record<string, unknown>): AnyNode[] {
  const out: AnyNode[] = []
  for (const node of children) {
    if (node.type === 'mdxjsEsm' || node.type === 'mdxFlowExpression') continue // drop exports / imports / {/* … */}
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      out.push(...rewriteJsx(node, scope))
      continue
    }
    if (Array.isArray(node.children)) node.children = rewrite(node.children, scope)
    out.push(node)
  }
  return out
}

function rewriteJsx(node: AnyNode, scope: Record<string, unknown>): AnyNode[] {
  const inner = () => rewrite(node.children ?? [], scope)
  switch (node.name) {
    case 'ConfigOptions': {
      const t = configTable(attrValue(node, 'items', scope))
      return t ? [html(t)] : []
    }
    case 'TypeTable': {
      const t = typeTable(attrValue(node, 'type', scope))
      return t ? [html(t)] : []
    }
    case 'Tab': {
      const label = attrSource(node, 'value')
      return [...(label ? [boldLine(label)] : []), ...inner()]
    }
    case 'Callout':
      return [{ type: 'blockquote', children: inner() }]
    case 'Card': {
      const title = attrSource(node, 'title') ?? ''
      const href = attrSource(node, 'href') ?? ''
      const desc = attrSource(node, 'description')
      return [html(`- [${title}](${href})${desc ? ` — ${desc}` : ''}`)]
    }
    default:
      // Tabs / Steps / Step / Cards / Accordions / anything unknown → unwrap, keep the children.
      return inner()
  }
}

/** Strip our MDX components out of processed markdown, leaving clean tables/blocks for LLMs. */
export async function cleanMarkdownForLLM(markdown: string): Promise<string> {
  // Drop the leading YAML frontmatter block (the title/description are added by the caller).
  const src = markdown.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  const file = await unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkStringify, { bullet: '-', fences: true, rule: '-' })
    .use(() => (tree: AnyNode) => {
      const scope: Record<string, unknown> = {}
      collectExports(tree, scope)
      tree.children = rewrite(tree.children ?? [], scope)
    })
    .process(src)
  return String(file).trim()
}
