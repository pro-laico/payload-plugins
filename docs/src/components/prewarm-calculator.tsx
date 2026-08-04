'use client'

import { useMemo, useState } from 'react'

/**
 * Interactive prewarm calculator for the payload-images docs: pick config + image settings and see
 * every width the endpoint could ever store as a tick line — color-coded by whether (and why) the
 * default strategy prewarms it. The math mirrors the plugin byte for byte: the snap grid/ladder
 * union, stepWidths for 'srcset', the every-Nth descending sample, unit priority order, per-target
 * format expansion, dedupe by cache identity, and the hard maxVariantsPerImage cut.
 */

const MAX_DIM = 4096
const LADDER = [640, 750, 828, 1080, 1200, 1920, 2048, 3840]
const Q_BUCKETS = 12 // quality snaps to multiples of 5 in [40, 95]
const FITS = 5

type Unit = 'builtin' | 'seed' | 'learned'

interface Target {
  w: number
  unit: Unit
  label: string
  ratio: string
  ratioV: number | null // null = no ratio on the URL (the src render)
  q: number
  formats: string[]
  cut: boolean // derived past the maxVariantsPerImage cap — not in the plan
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

const snapW = (n: number, step: number, ladder: number[] | null): number => {
  const grid = clamp(Math.round(n / step) * step, Math.min(step, MAX_DIM), MAX_DIM)
  if (!ladder?.length) return grid
  const rung = ladder.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best))
  return Math.abs(rung - n) < Math.abs(grid - n) ? rung : grid
}

const reachableWidths = (step: number, ladder: number[] | null): number[] => {
  const widths = new Set<number>()
  for (let w = step; w < MAX_DIM; w += step) widths.add(w)
  widths.add(MAX_DIM)
  for (const w of ladder ?? []) widths.add(w)
  return [...widths].sort((a, b) => a - b)
}

const everyNth = (srcW: number, n: number, step: number, ladder: number[] | null): number[] => {
  const pool = reachableWidths(step, ladder).filter((w) => w <= Math.min(srcW, MAX_DIM))
  return pool.filter((_, i) => (pool.length - 1 - i) % n === 0)
}

// The cap's even spread: when a unit doesn't fit the remaining budget, keep an evenly distributed
// subset (both extremes survive at 2+ slots) instead of cutting the large end.
const spreadWidths = (widths: number[], slots: number): number[] => {
  const n = widths.length
  if (slots <= 0) return []
  if (n <= slots) return widths
  if (slots === 1) return widths.slice(-1)
  const picked = new Set<number>()
  for (let i = 0; i < slots; i++) picked.add(Math.round((i * (n - 1)) / (slots - 1)))
  return widths.filter((_, i) => picked.has(i))
}

// Three simulated learned profiles — what a bit of real traffic would have taught the registry,
// ranked by hit count (their widths are the browser-chosen ones, so they come pre-snapped-ish).
const LEARNED_PROFILES = [
  { label: 'learned 16:9 q80', ratio: '16:9', ratioV: 16 / 9, q: 80, widths: [1200, 800] },
  { label: 'learned 4:3 q75', ratio: '4:3', ratioV: 4 / 3, q: 75, widths: [900] },
  { label: 'learned 1:1 q90', ratio: '1:1', ratioV: 1, q: 90, widths: [400, 200] },
]

// Selectable seed crops — each warms at the strategy's width axis. `1:1 q80` is the plugin's
// default seed; declaring anything replaces it, hence independent toggles.
const SEED_CHOICES = [
  { key: 'square', label: '1:1 q80', ratio: '1:1', ratioV: 1, q: 80, isDefault: true },
  { key: 'wide', label: '16:9 q80', ratio: '16:9', ratioV: 16 / 9, q: 80, isDefault: false },
  { key: 'photo', label: '4:3 q75', ratio: '4:3', ratioV: 4 / 3, q: 75, isDefault: false },
]

const UNIT_META: Record<Unit, { dot: string; tick: string; name: string }> = {
  builtin: { dot: 'bg-violet-500', tick: 'bg-violet-500', name: 'built-in' },
  seed: { dot: 'bg-amber-500', tick: 'bg-amber-500', name: 'seed' },
  learned: { dot: 'bg-sky-500', tick: 'bg-sky-500', name: 'learned' },
}

export function PrewarmCalculator() {
  const [srcW, setSrcW] = useState(2400)
  const [useLadder, setUseLadder] = useState(false)
  const [step, setStep] = useState(50)
  const [every, setEvery] = useState(5)
  const [avif, setAvif] = useState(false)
  const [builtIns, setBuiltIns] = useState(true)
  const [seeds, setSeeds] = useState<Set<string>>(new Set(['square']))
  const [learned, setLearned] = useState(false)
  const [cap, setCap] = useState(32)
  const [hovered, setHovered] = useState<number | null>(null)

  const ladder = useLadder ? LADDER : null
  const formats = avif ? ['webp', 'avif'] : ['webp']

  const model = useMemo(() => {
    const strategyWidths = everyNth(srcW, every, step, ladder)

    // Units in the plugin's priority order — the cap cuts from the tail.
    const units: { unit: Unit; label: string; ratio: string; ratioV: number | null; q: number; widths: number[] }[] = []
    if (builtIns) {
      units.push(
        {
          unit: 'builtin',
          label: 'src',
          ratio: 'none (no h on the URL)',
          ratioV: null,
          q: 90,
          widths: [snapW(Math.min(srcW, 1280), step, ladder)],
        },
        { unit: 'builtin', label: 'thumbnailURL', ratio: '1:1', ratioV: 1, q: 90, widths: [snapW(160, step, ladder)] },
        { unit: 'builtin', label: 'placeholderURL', ratio: 'natural (3:2)', ratioV: 1.5, q: 40, widths: [snapW(32, step, ladder)] },
      )
    }
    for (const c of SEED_CHOICES) {
      if (seeds.has(c.key))
        units.push({ unit: 'seed', label: `seed ${c.label}`, ratio: c.ratio, ratioV: c.ratioV, q: c.q, widths: strategyWidths })
    }
    if (learned) for (const p of LEARNED_PROFILES) units.push({ unit: 'learned', ...p, widths: p.widths.filter((w) => w <= srcW) })

    const targets: Target[] = []
    const seen = new Set<string>()
    let count = 0
    for (const u of units) {
      // Snap + dedupe this unit's widths, then spread them across the remaining budget: a unit
      // that doesn't fit keeps an even subset (every other width at half budget) — the rest show
      // as cut, exactly what the real plan drops.
      const unitWidths = [...new Set(u.widths.map((raw) => snapW(Math.min(raw, srcW), step, ladder)))]
      const kept = new Set(spreadWidths(unitWidths, Math.floor((cap - count) / formats.length)))
      for (const w of unitWidths) {
        const key = `${w}|${u.ratio}|${u.q}`
        if (seen.has(key)) continue
        seen.add(key)
        const cut = !kept.has(w)
        targets.push({ w, unit: u.unit, label: u.label, ratio: u.ratio, ratioV: u.ratioV, q: u.q, formats, cut })
        if (!cut) count += formats.length
      }
    }

    const reachable = reachableWidths(step, ladder)
    const byWidth = new Map<number, Target[]>()
    for (const t of targets) byWidth.set(t.w, [...(byWidth.get(t.w) ?? []), t])

    const possible = reachable.filter((w) => w <= srcW)
    const warm = targets.filter((t) => !t.cut)
    const warmVariants = warm.reduce((n, t) => n + t.formats.length, 0)
    const byUnit = { builtin: 0, seed: 0, learned: 0 } as Record<Unit, number>
    for (const t of warm) byUnit[t.unit] += t.formats.length
    return { reachable, byWidth, possible, warm, warmVariants, byUnit, truncated: targets.some((t) => t.cut) }
  }, [srcW, step, ladder, every, builtIns, seeds, learned, cap, formats])

  const fullSpace = model.possible.length * Q_BUCKETS * FITS * formats.length
  const hoveredTargets = hovered != null ? (model.byWidth.get(hovered) ?? []) : []

  const pct = (w: number) => (w / MAX_DIM) * 100

  // One segment per warmed render at this width — a seed stacks a second crop ON TOP of the
  // ladder's natural render at the same width, instead of recoloring it.
  const tickMark = (w: number) => {
    const ts = model.byWidth.get(w)
    if (w > srcW) return <div className="h-2 w-px self-end rounded-full bg-fd-border opacity-50" />
    if (!ts?.length) return <div className="h-3 w-px self-end rounded-full bg-fd-muted-foreground/35" />
    return (
      <div className="flex flex-col-reverse items-center gap-px self-end">
        {ts.flatMap((t) =>
          t.formats.map((fmt) => (
            <div key={`${t.label}${t.q}${fmt}`} className={`h-2 w-0.5 rounded-full ${t.cut ? 'bg-rose-500' : UNIT_META[t.unit].tick}`} />
          )),
        )}
      </div>
    )
  }

  return (
    <div className="not-prose my-6 rounded-xl border bg-fd-card p-4 text-sm">
      {/* ——— the tick line ——— */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover-only reset for a purely illustrative visual */}
      <div className="relative" onMouseLeave={() => setHovered(null)}>
        {hovered != null && (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-2 w-max min-w-60 max-w-[min(36rem,95vw)] -translate-x-1/2 rounded-lg border bg-fd-popover p-3 shadow-md"
            style={{ left: `${clamp(pct(hovered), 34, 66)}%` }}
          >
            <div className="mb-1 font-medium text-fd-foreground">{hovered}px wide</div>
            {hovered > srcW ? (
              <div className="text-xs text-fd-muted-foreground">Beyond this source's width — never generated (no upscaling).</div>
            ) : hoveredTargets.length === 0 ? (
              <div className="text-xs text-fd-muted-foreground">
                Possible, not prewarmed — generated on first request; until then the fallback serves the nearest warm width.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {hoveredTargets.map((t) => (
                  <li key={`${t.label}${t.q}`} className="whitespace-nowrap text-xs leading-snug">
                    <span
                      className={`mr-1.5 inline-block size-2 rounded-full align-baseline ${t.cut ? 'bg-rose-500' : UNIT_META[t.unit].dot}`}
                    />
                    <span className="font-medium text-fd-foreground">{t.label}</span>{' '}
                    <span className="text-fd-muted-foreground">
                      {t.w}
                      {t.ratioV ? `×${Math.round(t.w / t.ratioV)}` : ''} · {t.ratio} · q{t.q} · {t.formats.join(' + ')}
                      {t.cut ? ' — dropped by the cap' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="h-16 rounded-md border bg-fd-background px-1">
          <div className="relative h-full">
            {/* beyond-source shading */}
            <div className="absolute inset-y-1 right-0 rounded-r bg-fd-muted/40" style={{ width: `${100 - pct(Math.min(srcW, MAX_DIM))}%` }} />
            {model.reachable.map((w) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: hover-only inspection of a purely illustrative mark
              <div
                key={w}
                className={`absolute bottom-2 flex w-2 -translate-x-1/2 cursor-crosshair justify-center pt-6 ${hovered === w ? 'rounded bg-fd-primary/15' : ''}`}
                style={{ left: `${pct(w)}%`, height: '100%' }}
                onMouseEnter={() => setHovered(w)}
              >
                {tickMark(w)}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1 flex justify-between text-[0.65rem] text-fd-muted-foreground">
          <span>0px</span>
          <span>{MAX_DIM}px (maxDimension)</span>
        </div>
      </div>

      {/* ——— legend ——— */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fd-muted-foreground">
        <span>
          <span className="mr-1.5 inline-block size-2 rounded-full bg-violet-500" />
          built-ins
        </span>
        <span>
          <span className="mr-1.5 inline-block size-2 rounded-full bg-amber-500" />
          seeds
        </span>
        <span>
          <span className="mr-1.5 inline-block size-2 rounded-full bg-sky-500" />
          learned
        </span>
        <span>
          <span className="mr-1.5 inline-block size-2 rounded-full bg-rose-500" />
          cut by the cap
        </span>
        <span>
          <span className="mr-1.5 inline-block size-2 rounded-full bg-fd-muted-foreground/40" />
          possible, on-demand only
        </span>
        <span>
          <span className="mr-1.5 inline-block size-2 rounded-full bg-fd-border" />
          beyond the source
        </span>
        <span className="text-fd-muted-foreground/70">stacked segments = multiple renders at one width</span>
      </div>

      {/* ——— totals ——— */}
      <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-3">
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2">
          <div className="flex justify-between text-[0.65rem] font-medium uppercase tracking-wider">
            <span className="text-emerald-600 dark:text-emerald-400">prewarmed</span>
            {model.truncated && <span className="text-rose-500">capped</span>}
          </div>
          <div className="text-xl font-semibold text-fd-foreground">
            {model.warmVariants}{' '}
            <span className="text-xs font-normal text-fd-muted-foreground">
              variant{model.warmVariants === 1 ? '' : 's'} / cap {cap}
            </span>
          </div>
          <div className="mt-0.5 text-[0.7rem] text-fd-muted-foreground">
            <span className="mr-2">
              <span className="mr-1 inline-block size-1.5 rounded-full bg-violet-500" />
              {model.byUnit.builtin} built-in
            </span>
            <span className="mr-2">
              <span className="mr-1 inline-block size-1.5 rounded-full bg-amber-500" />
              {model.byUnit.seed} seed
            </span>
            {learned && (
              <span>
                <span className="mr-1 inline-block size-1.5 rounded-full bg-sky-500" />
                {model.byUnit.learned} learned
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-fd-background px-3 py-2">
          <div className="text-[0.65rem] font-medium uppercase tracking-wider text-fd-muted-foreground">reachable widths</div>
          <div className="text-xl font-semibold text-fd-foreground">{model.possible.length}</div>
          <div className="mt-0.5 text-[0.7rem] text-fd-muted-foreground">for this source — the ticks left of the shade</div>
        </div>
        <div className="rounded-lg border bg-fd-background px-3 py-2">
          <div className="text-[0.65rem] font-medium uppercase tracking-wider text-fd-muted-foreground">storable variants</div>
          <div className="text-xl font-semibold text-fd-foreground">{fullSpace.toLocaleString()}</div>
          <div className="mt-0.5 text-[0.7rem] text-fd-muted-foreground">
            widths × qualities × fits × formats, at ONE ratio — each declared ratio multiplies again
          </div>
        </div>
      </div>

      {/* ——— controls (default values render violet, like the built-ins) ——— */}
      <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1 flex justify-between text-xs text-fd-muted-foreground">
            <span>Source image width</span>
            <span className="font-medium text-fd-foreground">{srcW}px</span>
          </span>
          <input
            type="range"
            min={200}
            max={4096}
            step={50}
            value={srcW}
            onChange={(e) => setSrcW(Number(e.target.value))}
            className="w-full accent-fd-primary"
          />
        </label>

        <div>
          <span className="mb-1 block text-xs text-fd-muted-foreground">pixelStep</span>
          <div className="flex gap-1">
            {[25, 50, 100].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setUseLadder(false)
                  setStep(s)
                }}
                className={`rounded-md border px-2 py-1 text-xs ${s === 50 ? 'text-violet-600 dark:text-violet-400' : ''} ${!useLadder && step === s ? 'border-fd-primary bg-fd-primary/10' : `hover:bg-fd-accent ${s === 50 ? '' : 'text-fd-muted-foreground'}`}`}
              >
                {s}px
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUseLadder(true)}
              className={`rounded-md border px-2 py-1 text-xs ${useLadder ? 'border-fd-primary bg-fd-primary/10 text-fd-foreground' : 'text-fd-muted-foreground hover:bg-fd-accent'}`}
            >
              ladder
            </button>
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs text-fd-muted-foreground">{'strategy.widths: { every: n }'}</span>
          <div className="flex gap-1">
            {[1, 2, 3, 5, 8, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEvery(n)}
                className={`rounded-md border px-2 py-1 text-xs ${n === 5 ? 'text-violet-600 dark:text-violet-400' : ''} ${every === n ? 'border-fd-primary bg-fd-primary/10' : `hover:bg-fd-accent ${n === 5 ? '' : 'text-fd-muted-foreground'}`}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-fd-muted-foreground">
          <input type="checkbox" checked={builtIns} onChange={(e) => setBuiltIns(e.target.checked)} className="accent-violet-500" />
          <span className="text-violet-600 dark:text-violet-400">builtIns</span>
          <span className="text-fd-muted-foreground/70">(src / thumbnail / placeholder)</span>
        </label>

        <div>
          <span className="mb-1 block text-xs text-fd-muted-foreground">seeds</span>
          <div className="flex gap-1">
            {SEED_CHOICES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() =>
                  setSeeds((prev) => {
                    const next = new Set(prev)
                    if (next.has(c.key)) next.delete(c.key)
                    else next.add(c.key)
                    return next
                  })
                }
                className={`rounded-md border px-2 py-1 text-xs ${c.isDefault ? 'text-violet-600 dark:text-violet-400' : ''} ${seeds.has(c.key) ? 'border-fd-primary bg-fd-primary/10' : `hover:bg-fd-accent ${c.isDefault ? '' : 'text-fd-muted-foreground'}`}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-fd-muted-foreground">
          <input type="checkbox" checked={learned} onChange={(e) => setLearned(e.target.checked)} className="accent-fd-primary" />
          learned
        </label>

        <div className="flex items-center gap-2 text-xs text-fd-muted-foreground">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={avif} onChange={(e) => setAvif(e.target.checked)} className="accent-fd-primary" />
            +avif <span className="text-fd-muted-foreground/70">(preferAvif)</span>
          </label>
          <label className="ml-auto flex items-center gap-1.5">
            cap
            <input
              type="number"
              min={1}
              max={200}
              value={cap}
              onChange={(e) => setCap(clamp(Number(e.target.value) || 1, 1, 200))}
              className={`w-14 rounded-md border bg-fd-background px-1.5 py-0.5 text-xs ${cap === 32 ? 'text-violet-600 dark:text-violet-400' : ''}`}
            />
          </label>
        </div>
      </div>
      <p className="mt-2 text-[0.7rem] text-fd-muted-foreground">
        <span className="text-violet-600 dark:text-violet-400">Violet values</span> are the plugin defaults. Assumes a 3:2 source.
      </p>
    </div>
  )
}
