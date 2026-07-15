import { EmptyState } from '@pro-laico/sandbox-shell'

import { Image } from './Image'
import type { Page } from '../payload-types'

/** One pages card: proves the upload relationship end to end by rendering the doc's heroImage. */
export function PageCard({ page }: { page: Page }) {
  const heroId = typeof page.heroImage === 'object' && page.heroImage ? page.heroImage.id : (page.heroImage ?? undefined)
  return (
    <div className="shell-card">
      <div className="shell-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <strong>{page.title ?? '(untitled)'}</strong>
        <small className="shell-muted">heroImage → {heroId ? `#${heroId}` : '(none)'}</small>
      </div>
      {heroId ? (
        <Image
          id={heroId}
          aspectRatio="16:9"
          image={{ aspectRatio: '16:9' }}
          blur={{ quality: 'md' }}
          sizes="(max-width: 920px) 100vw, 880px"
        />
      ) : (
        <EmptyState>No hero image set.</EmptyState>
      )}
    </div>
  )
}
