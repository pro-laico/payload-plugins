import { afterAll } from 'vitest'

/** Per-spec legibility report: call the returned `record` with every observed error/warning; the
 *  registered afterAll prints them under scenario banners, so a test run doubles as an eyeball
 *  pass over the actual message text. */
export function createReport(title: string): (scenario: string, ...lines: Array<string | undefined>) => void {
  const entries: Array<{ scenario: string; lines: string[] }> = []
  afterAll(() => {
    const out = entries.map((r) => `\n─── ${r.scenario} ───\n${r.lines.map((l) => `  ${l}`).join('\n')}`).join('\n')
    console.info(`\n══════ ${title} — failure legibility report ══════${out}\n`)
  })
  return (scenario, ...lines) => entries.push({ scenario, lines: lines.filter((l): l is string => Boolean(l)) })
}
