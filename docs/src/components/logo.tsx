import { Blocks } from 'lucide-react'
import type { ComponentProps } from 'react'

/** Placeholder mark for the docs site — swap for a real brand logo later.
 *  Inherits `currentColor` so it adapts to light/dark. */
export function Logo(props: ComponentProps<typeof Blocks>) {
  return <Blocks aria-hidden="true" {...props} />
}

export default Logo
