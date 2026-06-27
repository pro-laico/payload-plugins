'use client'

import { toast } from '@payloadcms/ui'
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

export interface SeedButtonProps {
  /** Endpoint URL the button POSTs to. Defaults to `/api/seed`. */
  endpoint?: string
}

/** Admin dashboard button that triggers `POST /api/seed`. Injected via the plugin's
 *  `adminButton` option, or registered manually in `admin.components.beforeDashboard`. */
export const SeedButton: React.FC<SeedButtonProps> = ({ endpoint = '/api/seed' }) => {
  const [seeded, setSeeded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<null | string>(null)

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()

      if (seeded) return toast.info('Database already seeded.')
      if (loading) return toast.info('Seeding already in progress.')
      if (error) return toast.error('An error occurred, please refresh and try again.')

      setLoading(true)

      const run = fetch(endpoint, { method: 'POST', credentials: 'include' })
        .then((res) => {
          if (!res.ok) throw new Error('An error occurred while seeding.')
          setSeeded(true)
          return true
        })
        .catch((err) => {
          const wrapped = err instanceof Error ? err : new Error(String(err))
          setError(wrapped.message)
          throw wrapped
        })
        .finally(() => setLoading(false))

      toast.promise(run, { loading: 'Seeding with data....', success: <SuccessMessage />, error: 'An error occurred while seeding.' })
    },
    [loading, seeded, error, endpoint],
  )

  let message = ''
  if (loading) message = ' (seeding...)'
  if (seeded) message = ' (done!)'
  if (error) message = ` (error: ${error})`

  return (
    <button type="button" onClick={handleClick} disabled={loading || seeded}>
      Seed your database{message}
    </button>
  )
}

export default SeedButton
