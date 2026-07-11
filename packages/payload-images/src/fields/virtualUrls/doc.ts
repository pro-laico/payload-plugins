/**
 * The natural-ratio helper over the virtual-URL doc shape — a leaf shared by the field builders
 * (fields/virtualUrls) and their afterRead hooks (hooks/field).
 */
import type { ImageDocLike } from '../../types'

export const naturalAspectRatio = (d: ImageDocLike): number | undefined => (d.width && d.height ? d.width / d.height : undefined)
