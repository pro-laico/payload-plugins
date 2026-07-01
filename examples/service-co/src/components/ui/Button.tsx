import { cva, type VariantProps } from 'class-variance-authority'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { CmsIcon } from '@/components/ui/CmsIcon'
import { cn } from '@/lib/cn'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-border text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
      },
      size: { sm: 'h-9 px-4 text-sm', md: 'h-11 px-6 text-sm', lg: 'h-12 px-7 text-base' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonLinkProps = VariantProps<typeof button> & {
  href: string
  children: ReactNode
  className?: string
  /** Append an arrow glyph (payload-icons drop-in) that nudges on hover. */
  arrow?: boolean
}

/** A link styled as a button. The optional trailing arrow is a CMS-managed icon (`<CmsIcon>`). */
export function ButtonLink({ href, children, className, variant, size, arrow }: ButtonLinkProps) {
  const external = href.startsWith('http')
  const content = (
    <>
      {children}
      {arrow ? <CmsIcon name="arrow-right" size="sm" className="transition-transform group-hover:translate-x-0.5" /> : null}
    </>
  )
  if (external) {
    return (
      <a href={href} className={cn('group', button({ variant, size }), className)}>
        {content}
      </a>
    )
  }
  return (
    <Link href={href} className={cn('group', button({ variant, size }), className)}>
      {content}
    </Link>
  )
}
