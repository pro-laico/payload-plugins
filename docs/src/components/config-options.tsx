import type { ReactNode } from 'react'

/**
 * Display for plugin/config options — name, type, default, description, and a collapsible drill-in
 * for nested options. Recurses with no depth limit (a nested option that itself has options just
 * keeps nesting). Native `<details>`-based — no client JS, server-renderable, accessible.
 *
 * Pass the options as a plain array; in MDX define it with `export const options = [...]` and render
 * `<ConfigOptions items={options} />`.
 */
export interface ConfigOption {
  name: string
  type?: string
  default?: string
  required?: boolean
  description?: ReactNode
  options?: ConfigOption[]
}

export interface ConfigOptionsProps {
  items: ConfigOption[]
}

// A single fixed surface, a touch off the page background (mixed slightly toward the text colour so
// it lifts subtly in both light and dark). Same shade at every level.
const SURFACE = 'color-mix(in oklab, var(--color-fd-background), var(--color-fd-foreground) 4%)'

const Name = ({ o }: { o: ConfigOption }) => <code className="font-semibold text-fd-foreground">{o.name}</code>

const Type = ({ o }: { o: ConfigOption }) => (o.type ? <code className="text-[0.85em] text-fd-muted-foreground">{o.type}</code> : null)

const Default = ({ o }: { o: ConfigOption }) =>
  o.default !== undefined ? (
    <span className="text-[0.85em] text-fd-muted-foreground">
      default <code className="rounded bg-fd-muted px-1 py-0.5 text-fd-foreground">{o.default}</code>
    </span>
  ) : null

const Required = ({ o }: { o: ConfigOption }) =>
  o.required ? <span className="text-[0.7em] font-medium uppercase tracking-wide text-fd-primary">required</span> : null

const Chevron = () => (
  <svg
    className="size-4 shrink-0 text-fd-muted-foreground transition-transform duration-200 group-open:rotate-90"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
)

const Meta = ({ o }: { o: ConfigOption }) => (
  <>
    <Name o={o} />
    <Type o={o} />
    <Required o={o} />
    <span className="sm:ml-auto">
      <Default o={o} />
    </span>
  </>
)

const metaRow = 'flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 [overflow-wrap:anywhere]'

const Options = ({ items }: { items: ConfigOption[] }) => (
  <div className="not-prose divide-y divide-fd-border overflow-hidden rounded-lg border border-fd-border" style={{ backgroundColor: SURFACE }}>
    {items.map((o) =>
      o.options?.length ? (
        <details key={o.name} className="group">
          <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2 hover:bg-fd-foreground/5">
            <span className="mt-0.5 shrink-0">
              <Chevron />
            </span>
            <span className={`flex-1 ${metaRow}`}>
              <Meta o={o} />
            </span>
          </summary>
          <div className="pb-3 pl-3 pr-1.5">
            {o.description ? <p className="mb-3 pl-6 text-sm text-fd-muted-foreground">{o.description}</p> : null}
            <Options items={o.options} />
          </div>
        </details>
      ) : (
        <div key={o.name} className="px-3 py-2 pl-9">
          <div className={metaRow}>
            <Meta o={o} />
          </div>
          {o.description ? <p className="mt-1 text-sm text-fd-muted-foreground">{o.description}</p> : null}
        </div>
      ),
    )}
  </div>
)

export function ConfigOptions({ items }: ConfigOptionsProps) {
  return <Options items={items} />
}
