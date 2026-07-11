import { extractSvgContent, extractSvgProps } from '@pro-laico/payload-icons'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import type { IconProps, IconSize, IconTone, IconVariant } from '@/types'

// The presentational, CVA-styled icon. It takes the already-fetched `svg` string (an icon doc's
// `svgString`) and inlines it as a real `<svg>` with size / tone / variant classes. The plugin
// ships no component (like payload-mux delegates playback) — `InlineSvg` below is the few lines
// an app writes once, using the plugin's `extractSvg*` helpers. Pure — works in a server or
// client tree. For the ergonomic name-based version that fetches for you, see `CmsIcon`.

/** Inline an icon's `svgString` as a real `<svg>`, merging a className onto it. */
const InlineSvg = ({ svg, className }: { svg: string; className?: string }) => (
  <svg aria-hidden="true" {...extractSvgProps(svg)} className={className} dangerouslySetInnerHTML={{ __html: extractSvgContent(svg) }} />
)

// Glyph box per size, and the (larger) frame box for the framed variants.
const glyphSize: Record<IconSize, string> = { xs: 'size-3.5', sm: 'size-4', base: 'size-5', lg: 'size-6', xl: 'size-8' }
const frameSize: Record<IconSize, string> = { xs: 'size-7', sm: 'size-8', base: 'size-9', lg: 'size-10', xl: 'size-12' }
const toneClass: Record<IconTone, string> = {
  current: '',
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  accent: 'text-accent',
  destructive: 'text-destructive',
}

// The framed variants (a colored/bordered circle around the glyph).
const frameVariants = cva('inline-flex shrink-0 items-center justify-center rounded-full', {
  variants: {
    variant: {
      outline: 'border border-border text-foreground',
      solid: 'bg-primary text-primary-foreground',
      ghost: 'text-foreground transition-colors hover:bg-muted',
    },
  },
})

const isFramed = (v: IconVariant): v is 'outline' | 'solid' | 'ghost' => v === 'outline' || v === 'solid' || v === 'ghost'

export const Icon = ({ svg, variant = 'standalone', size = 'base', tone = 'current', className }: IconProps) => {
  if (!svg) return null
  if (isFramed(variant)) {
    // tone is meaningful only on the bare glyph; framed variants carry their own color.
    return (
      <span className={cn(frameVariants({ variant }), frameSize[size], className)}>
        <InlineSvg svg={svg} className="size-[55%] shrink-0" />
      </span>
    )
  }
  // `inline` scales to the surrounding font (1em) and sits on the text baseline; `standalone`
  // uses the fixed size scale.
  const glyph = variant === 'inline' ? 'inline-block size-[1em] shrink-0 align-[-0.125em]' : cn('inline-block shrink-0', glyphSize[size])
  return <InlineSvg svg={svg} className={cn(glyph, toneClass[tone], className)} />
}

export default Icon
