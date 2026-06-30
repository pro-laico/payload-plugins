import config from '@payload-config'
// The plugin's drop-in component — one import, fetches by name and inlines the SVG (resolves
// config via the @payload-config alias on its own; no wiring).
import { Icon as PayloadIcon } from '@pro-laico/payload-icons/components/Icon'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'
import { CmsIcon } from '@/components/ui/CmsIcon'
import type { IconSize, IconTone, IconVariant } from '@/components/ui/Icon'

// Always read fresh so newly-seeded/uploaded icons show up on reload.
export const dynamic = 'force-dynamic'

const VARIANTS: IconVariant[] = ['standalone', 'outline', 'solid', 'ghost']
const SIZES: IconSize[] = ['xs', 'sm', 'base', 'lg', 'xl']
const TONES: IconTone[] = ['current', 'muted', 'primary', 'accent', 'destructive']

const iconName = (filename?: string | null): string => filename?.replace(/\.svg$/i, '') ?? 'icon'

/** A labeled showcase cell. */
const Cell = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="flex h-12 items-center justify-center">{children}</div>
    <code className="font-mono text-[11px] text-muted-foreground">{label}</code>
  </div>
)

/** A titled showcase section. */
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{title}</span>
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">{children}</div>
  </section>
)

export default async function Home() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'icon', limit: 24, overrideAccess: true })
  const names = docs.map((d) => iconName(d.filename))
  const name = names[0]

  return (
    <main className="mx-auto max-w-3xl space-y-12 px-6 py-16">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">Icons Sandbox</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A common-usage showcase for <code className="font-mono text-foreground">@pro-laico/payload-icons</code>: a{' '}
          <code className="font-mono text-foreground">cva</code> + Tailwind <code className="font-mono text-foreground">Icon</code> wrapper over
          the plugin's primitive. CMS-managed SVGs are optimized to <code className="font-mono text-foreground">currentColor</code> on upload,
          so a single source recolors and resizes from class names alone.
        </p>
        <p className="text-sm text-muted-foreground">
          Manage icons in the{' '}
          <a href="/admin" className="underline underline-offset-2 hover:text-foreground">
            admin panel
          </a>
          .
        </p>
      </header>

      {!name ? (
        <p className="text-sm text-muted-foreground">
          No icons yet — open <code className="rounded bg-muted px-1.5 py-0.5 font-mono">/admin</code>, click{' '}
          <strong className="text-foreground">Seed your database</strong> (or upload an SVG), then reload.
        </p>
      ) : (
        <div className="space-y-10">
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
    </main>
  )
}
