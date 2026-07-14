import type { ExtractedUsage, ExtractOptions } from '../types/index.js'

const DEFAULT_COMPONENTS = ['Icon']

const PLAUSIBLE_NAME = /^[\w-]+$/

const isWhitespace = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v'
const isIdentStart = (c: string): boolean => /[A-Za-z_$]/.test(c)
const isTagNameBoundary = (c: string | undefined): boolean => c === undefined || isWhitespace(c) || c === '/' || c === '>'

const buildLineIndex = (source: string): number[] => {
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  return starts
}

const lineColAt = (lineStarts: number[], index: number): { line: number; column: number } => {
  let lo = 0
  let hi = lineStarts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if ((lineStarts[mid] ?? 0) <= index) lo = mid
    else hi = mid - 1
  }
  return { line: lo + 1, column: index - (lineStarts[lo] ?? 0) + 1 }
}

const skipString = (source: string, i: number): number => {
  const quote = source[i]
  i++
  while (i < source.length) {
    const c = source[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === quote) return i + 1
    i++
  }
  return i
}

const skipTemplate = (source: string, i: number): number => {
  i++
  while (i < source.length) {
    const c = source[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === '`') return i + 1
    if (c === '$' && source[i + 1] === '{') {
      i = skipBraces(source, i + 1)
      continue
    }
    i++
  }
  return i
}

const skipBraces = (source: string, i: number): number => {
  let depth = 0
  while (i < source.length) {
    const c = source[i]
    if (c === '"' || c === "'") {
      i = skipString(source, i)
      continue
    }
    if (c === '`') {
      i = skipTemplate(source, i)
      continue
    }
    if (c === '/' && source[i + 1] === '/') {
      i = skipLineComment(source, i)
      continue
    }
    if (c === '/' && source[i + 1] === '*') {
      i = skipBlockComment(source, i)
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i + 1
    }
    i++
  }
  return i
}

const skipLineComment = (source: string, i: number): number => {
  i += 2
  while (i < source.length && source[i] !== '\n') i++
  return i
}

const skipBlockComment = (source: string, i: number): number => {
  i += 2
  while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++
  return Math.min(i + 2, source.length)
}

const interpretExpression = (inner: string): string | null => {
  const expr = inner.trim()
  if (expr.length < 2) return null
  const first = expr[0]
  const last = expr[expr.length - 1]
  if ((first === '"' || first === "'") && last === first) {
    if (skipString(expr, 0) !== expr.length) return null
    return unquote(expr)
  }
  if (first === '`' && last === '`') {
    if (skipTemplate(expr, 0) !== expr.length) return null
    if (expr.includes('${')) return null
    return expr.slice(1, -1)
  }
  return null
}

const unquote = (literal: string): string => {
  const body = literal.slice(1, -1)
  return body.replace(/\\(.)/g, (_, ch: string) => {
    switch (ch) {
      case 'n':
        return '\n'
      case 't':
        return '\t'
      case 'r':
        return '\r'
      default:
        return ch
    }
  })
}

const parseNameAttr = (source: string, start: number): { name: string; index: number } | null => {
  let i = start
  while (i < source.length) {
    const c = source.charAt(i)
    if (isWhitespace(c)) {
      i++
      continue
    }
    if (c === '>') return null
    if (c === '/' && source[i + 1] === '>') return null
    if (c === '{') {
      i = skipBraces(source, i)
      continue
    }
    if (!isIdentStart(c) && c !== '-') {
      i++
      continue
    }
    const attrStart = i
    while (i < source.length && /[\w:-]/.test(source.charAt(i))) i++
    const attrName = source.slice(attrStart, i)
    let j = i
    while (j < source.length && isWhitespace(source.charAt(j))) j++
    if (source[j] !== '=') {
      i = j
      continue
    }
    j++
    while (j < source.length && isWhitespace(source.charAt(j))) j++
    const valChar = source[j]
    let valueIndex = j
    let value: string | null
    if (valChar === '"' || valChar === "'") {
      const end = skipString(source, j)
      value = unquote(source.slice(j, end))
      i = end
    } else if (valChar === '{') {
      const end = skipBraces(source, j)
      value = interpretExpression(source.slice(j + 1, end - 1))
      valueIndex = j + 1
      i = end
    } else {
      return null
    }
    if (attrName === 'name') {
      return value === null ? null : { name: value, index: valueIndex }
    }
  }
  return null
}

export const extractIconUsages = (source: string, options: ExtractOptions = {}): ExtractedUsage[] => {
  const components = options.components?.length ? options.components : DEFAULT_COMPONENTS
  const componentSet = new Set(components)
  const lineStarts = buildLineIndex(source)
  const usages: ExtractedUsage[] = []
  const n = source.length
  let i = 0

  while (i < n) {
    if (source[i] !== '<') {
      i++
      continue
    }
    let k = i + 1
    if (k >= n || !isIdentStart(source.charAt(k))) {
      i++
      continue
    }
    const nameStart = k
    while (k < n && /[\w.]/.test(source.charAt(k))) k++
    const tagName = source.slice(nameStart, k)
    if (!componentSet.has(tagName) || !isTagNameBoundary(source[k])) {
      i = k
      continue
    }
    const linePrefix = source.slice(source.lastIndexOf('\n', i - 1) + 1, i).trimStart()
    if (linePrefix.startsWith('//') || linePrefix.startsWith('*')) {
      i = k
      continue
    }
    const found = parseNameAttr(source, k)
    if (found && PLAUSIBLE_NAME.test(found.name.trim())) {
      const { line, column } = lineColAt(lineStarts, found.index)
      usages.push({ name: found.name.trim(), line, column })
    }
    i = k
  }

  return usages
}
