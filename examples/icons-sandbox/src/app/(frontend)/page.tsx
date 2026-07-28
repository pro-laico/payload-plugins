import { Suspense } from 'react'
import { EmptyState, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'

import { CmsIcon } from '@/components/ui/CmsIcon'
import { getIcons, getStatus } from '@/lib/getters'
import { Cell, Section } from '@/components/showcase'
import { Icon as PayloadIcon } from '@/components/PayloadIcon'
import type { IconSize, IconTone, IconVariant } from '@/types'

const SIZES: IconSize[] = ['xs', 'sm', 'base', 'lg', 'xl']
const VARIANTS: IconVariant[] = ['standalone', 'outline', 'solid', 'ghost']
const TONES: IconTone[] = ['current', 'muted', 'primary', 'accent', 'destructive']

export default function Home() {
  return (
    <SandboxShell
      title="Icons Sandbox"
      packageName="@pro-laico/payload-icons"
      docsHref="https://payload-plugins.prolaico.com/docs/plugins/payload-icons"
      accent="oklch(0.75 0.15 165)"
      lead={
        <>
          A common-usage showcase for <code>@pro-laico/payload-icons</code>: a <code>cva</code> + Tailwind <code>Icon</code> wrapper over the
          plugin's primitive. CMS-managed SVGs are optimized to <code>currentColor</code> on upload, so a single source recolors and resizes
          from class names alone.
        </>
      }
    >
      {/* Cached reads, so this prerenders. Any icon write busts the tag and it re-renders. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading icons…</p>}>
        <Showcase />
      </Suspense>
    </SandboxShell>
  )
}

/** Seed status and the seeded icons through cached getters — read per change, not per request. */
async function Showcase() {
  const [status, docs] = await Promise.all([getStatus(), getIcons()])
  const names = docs.map((d) => d.filename?.replace(/\.svg$/i, '') ?? 'icon')
  const name = names[0]

  return (
    <>
      <SeedPanel seeded={status.seeded} counts={status.counts} />

      {!name ? (
        <EmptyState>No icons yet — seed the database above, or upload an SVG in the admin, then reload.</EmptyState>
      ) : (
        <div className="space-y-10 pt-6">
          <Section title="the drop-in component — <Icon name> from the plugin, one import">
            {names.map((n) => (
              <Cell key={n} label={n}>
                <PayloadIcon name={n} className="size-6 text-primary" />
              </Cell>
            ))}
          </Section>

          <Section title="variant">
            <Cell label="standalone">
              <CmsIcon name={name} />
            </Cell>
            <Cell label="outline">
              <CmsIcon name={name} variant="outline" />
            </Cell>
            <Cell label="solid">
              <CmsIcon name={name} variant="solid" />
            </Cell>
            <Cell label="ghost">
              <CmsIcon name={name} variant="ghost" />
            </Cell>
            <Cell label="inline">
              <span className="text-base">
                in <CmsIcon name={name} variant="inline" /> text
              </span>
            </Cell>
          </Section>

          <Section title="size · standalone">
            {SIZES.map((size) => (
              <Cell key={size} label={size}>
                <CmsIcon name={name} size={size} />
              </Cell>
            ))}
          </Section>

          <Section title="tone — one source SVG, recolored by class">
            {TONES.map((tone) => (
              <Cell key={tone} label={tone}>
                <CmsIcon name={name} size="lg" tone={tone} />
              </Cell>
            ))}
          </Section>

          <Section title="variant × size — framed">
            {VARIANTS.filter((v) => v !== 'standalone').map((variant) => (
              <Cell key={variant} label={variant}>
                <div className="flex items-center gap-2">
                  {SIZES.map((size) => (
                    <CmsIcon key={size} name={name} variant={variant} size={size} />
                  ))}
                </div>
              </Cell>
            ))}
          </Section>

          {names.length > 1 && (
            <Section title="the collection">
              {names.map((n) => (
                <Cell key={n} label={n}>
                  <CmsIcon name={n} size="lg" tone="primary" />
                </Cell>
              ))}
            </Section>
          )}

          <section className="space-y-2 border-t border-border pt-8">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              inline — flows with text, scales to the font
            </span>
            <p className="text-sm">
              Small copy with an <CmsIcon name={name} variant="inline" /> inline icon mid-sentence.
            </p>
            <p className="text-2xl">
              Large copy with an <CmsIcon name={name} variant="inline" /> inline icon mid-sentence.
            </p>
          </section>
        </div>
      )}
    </>
  )
}
