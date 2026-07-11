import { cn } from '@/lib/cn'
import type { Props } from '@/types/props/section-heading'

/** A consistent section header — a mono eyebrow, a serif display title, and an optional lead. */
export function SectionHeading({ eyebrow, title, description, align = 'left', className }: Props) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow ? <div className="font-mono text-xs uppercase tracking-[0.18em] text-primary">{eyebrow}</div> : null}
      <h2 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">{title}</h2>
      {description ? <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p> : null}
    </div>
  )
}
