import type { CollectionSlug, Payload } from 'payload'
import { ICON_SLUG } from '../collections/Icon'
import type { IconDoc } from '../types'

export interface GetIconOptions {
  /** The icon collection slug. @default 'icon' */
  collection?: string
}

/**
 * Look up a stored icon by name (its filename, with or without the `.svg` extension) — the
 * server-side bridge for rendering an icon. Reads with `overrideAccess`, so it works from server
 * components / route handlers regardless of the read gate. Returns the icon doc (with `svgString`)
 * or `null` when nothing matches.
 *
 * @example
 * ```tsx
 * import { getIcon, extractSvgContent, extractSvgProps } from '@pro-laico/payload-icons'
 *
 * const icon = await getIcon(payload, 'arrow-right')
 * if (!icon?.svgString) return null
 * return <svg {...extractSvgProps(icon.svgString)} className="size-6" dangerouslySetInnerHTML={{ __html: extractSvgContent(icon.svgString) }} />
 * ```
 */
export async function getIcon(payload: Payload, name: string, options: GetIconOptions = {}): Promise<IconDoc | null> {
  const collection = (options.collection ?? ICON_SLUG) as CollectionSlug
  const withExt = name.endsWith('.svg') ? name : `${name}.svg`

  const res = await payload.find({
    collection,
    where: { or: [{ filename: { equals: name } }, { filename: { equals: withExt } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return (res.docs[0] as IconDoc | undefined) ?? null
}
