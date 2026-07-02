'use client'

import { toast, useConfig } from '@payloadcms/ui'
import type React from 'react'
import { useCallback, useState } from 'react'

const SuccessMessage: React.FC = () => (
  <div>
    Database seeded! You can now{' '}
    <a target="_blank" href="/" rel="noreferrer">
      visit your website
    </a>
  </div>
)

const MAX_SHOWN_ISSUES = 5

const summarizeIssues = (issues: string[]): string => {
  const shown = issues.slice(0, MAX_SHOWN_ISSUES)
  const more = issues.length - shown.length
  return shown.join('\n') + (more > 0 ? `\n…and ${more} more` : '')
}

interface SeedResponseBody {
  error?: string
  issues?: string[]
  message?: string
}

export interface SeedButtonProps {
  /** Endpoint URL the button POSTs to. Defaults to `<routes.api>/seed` from the admin config. */
  endpoint?: string
}

/** Admin dashboard button that triggers `POST /api/seed`. Injected via the plugin's
 *  `adminButton` option, or registered manually in `admin.components.beforeDashboard`.
 *  The seed wipes seeded collections, so the first click arms a confirm and the second runs. */
export const SeedButton: React.FC<SeedButtonProps> = ({ endpoint }) => {
  const { config } = useConfig()
  const url = endpoint ?? `${config.serverURL ?? ''}${config.routes.api}/seed`
  const [seeded, setSeeded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const [confirming, setConfirming] = useState(false)

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()

      if (loading) return toast.info('Seeding already in progress.')
      if (!confirming) return setConfirming(true)

      setConfirming(false)
      setError(null)
      setLoading(true)

      const run = fetch(url, { method: 'POST', credentials: 'include' })
        .then(async (res) => {
          const body = (await res.json().catch(() => ({}))) as SeedResponseBody
          if (!res.ok) {
            const base = body.error ?? 'An error occurred while seeding.'
            throw new Error(body.issues?.length ? `${base}\n${summarizeIssues(body.issues)}` : base)
          }
          setSeeded(true)
          return body
        })
        .catch((err) => {
          const wrapped = err instanceof Error ? err : new Error(String(err))
          setError(wrapped.message)
          throw wrapped
        })
        .finally(() => setLoading(false))

      toast.promise(run, {
        loading: 'Seeding with data....',
        success: (body) => body.message ?? <SuccessMessage />,
        error: (err) => (err instanceof Error ? err.message : 'An error occurred while seeding.'),
      })
    },
    [loading, confirming, url],
  )

  let message = ''
  if (seeded) message = ' (done — click to reseed)'
  if (error) message = ` (error: ${error} — click to retry)`
  if (confirming) message = ' — click again to confirm: this wipes seeded collections'
  if (loading) message = ' (seeding...)'

  return (
    <button type="button" onClick={handleClick} disabled={loading}>
      Seed your database{message}
    </button>
  )
}

export default SeedButton
