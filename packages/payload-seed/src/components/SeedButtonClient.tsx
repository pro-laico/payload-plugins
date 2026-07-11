'use client'

import { toast, useConfig } from '@payloadcms/ui'
import type React from 'react'
import { useCallback, useState } from 'react'
import type { SeedButtonProps, SeedResponseBody } from '../types'

export type { SeedButtonProps }

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

/** The client half of the seed button — assumes seeding is enabled (the `SeedButton` server
 *  gate checks `ENABLE_SEED` and renders this only when the endpoint would accept the run).
 *  The seed wipes seeded collections, so the first click arms a confirm and the second runs. */
export const SeedButtonClient: React.FC<SeedButtonProps> = ({ endpoint }) => {
  const { config } = useConfig()
  const url = endpoint ?? `${config.serverURL ?? ''}${config.routes.api}/seed`
  const [seeded, setSeeded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()

      if (loading) return toast.info('Seeding already in progress.')
      if (!confirming) return setConfirming(true)

      setConfirming(false)
      setFailed(false)
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
          setFailed(true)
          throw err instanceof Error ? err : new Error(String(err))
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
  if (failed) message = ' (failed — click to retry)'
  if (confirming) message = ' — click again to confirm: this wipes seeded collections'
  if (loading) message = ' (seeding...)'

  return (
    <button type="button" onClick={handleClick} disabled={loading}>
      Seed your database{message}
    </button>
  )
}

export default SeedButtonClient
