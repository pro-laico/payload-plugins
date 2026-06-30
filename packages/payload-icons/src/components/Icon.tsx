import { getPayload, type SanitizedConfig } from 'payload'
import type React from 'react'
import { extractSvgContent, extractSvgProps } from '../lib/extractSVG'
import { getIcon } from '../lib/getIcon'

type Awaitable<T> = T | Promise<T>

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  /** Icon name — the filename with or without `.svg` (e.g. `arrow-right`). Fetched server-side.
   *  Omit when you pass `svg` directly. */
  name?: string
  /** A pre-fetched `svgString` (e.g. from a populated relationship, or a bulk `getIcon`). When
   *  set, the component skips the lookup and just renders it. */
  svg?: string | null
  /** Payload config. Defaults to the `@payload-config` alias that `withPayload` sets up (the
   *  standard Next + Payload setup); pass it explicitly for non-aliased setups. */
  config?: Awaitable<SanitizedConfig>
  /** The icon collection slug. @default 'icon' */
  collection?: string
}

/**
 * Drop-in component that fetches a CMS icon by `name` and inlines it as a real `<svg>` — the one
 * frontend import you need, no wrapper file. It's an async **server component** (it queries
 * Payload), so render it in a server component / page. Your JSX props win over the SVG's intrinsic
 * attributes, and it inherits CSS `color` via `currentColor`. Renders nothing if the name doesn't
 * resolve.
 *
 * Already holding the string (a populated relationship, or many icons fetched at once)? Pass `svg`
 * to skip the lookup. For client components, use `getIcon` + `extractSvg*` directly.
 *
 * @example
 * ```tsx
 * import { Icon } from '@pro-laico/payload-icons/components/Icon'
 *
 * <Icon name="arrow-right" className="size-6 text-primary" />
 * <Icon svg={page.icon.svgString} className="size-6" />   // already have it
 * ```
 */
export const Icon = async ({ name, svg, config, collection, ...svgProps }: IconProps): Promise<React.ReactElement | null> => {
  let source = svg ?? null
  if (source == null && name) {
    // `@payload-config` is provided by the host app's bundler alias (set up by `withPayload`). The
    // `as string` keeps TS from resolving it at this package's build time; swc emits the literal
    // specifier, so the host bundler's alias still applies.
    const cfg = config ?? ((await import('@payload-config' as string)).default as Awaitable<SanitizedConfig>)
    const payload = await getPayload({ config: cfg })
    source = (await getIcon(payload, name, { collection }))?.svgString ?? null
  }
  if (!source) return null
  // `source` is sanitized by formatSVGHook on upload (scripts / on* handlers / javascript: URLs
  // stripped), so inlining it is safe.
  return <svg aria-hidden="true" {...extractSvgProps(source)} {...svgProps} dangerouslySetInnerHTML={{ __html: extractSvgContent(source) }} />
}

export default Icon
