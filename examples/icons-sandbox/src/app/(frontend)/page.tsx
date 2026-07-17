import { Suspense } from 'react'
import { connection } from 'next/server'
import { type CollectionSlug, getPayload } from 'payload'
import { EmptyState, getSeedStatus, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'

import config from '@payload-config'
import { CmsIcon } from '@/components/ui/CmsIcon'
import { Cell, Section } from '@/components/showcase'
import { Icon as PayloadIcon } from '@/components/PayloadIcon'
import type { IconSize, IconTone, IconVariant } from '@/types'

const SEEDED_SLUGS: CollectionSlug[] = ['icon', 'iconSet', 'pages']

const SIZES: IconSize[] = ['xs', 'sm', 'base', 'lg', 'xl']
const VARIANTS: IconVariant[] = ['standalone', 'outline', 'solid', 'ghost']
const TONES: IconTone[] = ['current', 'muted', 'primary', 'accent', 'destructive']

const iconName = (filename?: string | null): string => filename?.replace(/\.svg$/i, '') ?? 'icon'

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
      {/* Live reads are a dynamic hole inside Suspense — the shell around them prerenders. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading icons…</p>}>
        <Showcase />
      </Suspense>
    </SandboxShell>
  )
}

/** The live, per-request part: seed status + the seeded icons. `connection()` marks it dynamic, so
 * it streams into the Suspense hole instead of prerendering with build-time data. */
async function Showcase() {
  await connection()
  const payload = await getPayload({ config })
  const status = await getSeedStatus(payload, SEEDED_SLUGS)
  const { docs } = await payload.find({ collection: 'icon', limit: 24 })
  const names = docs.map((d) => iconName(d.filename))
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
