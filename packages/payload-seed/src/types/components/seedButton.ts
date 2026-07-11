export interface SeedResponseBody {
  error?: string
  issues?: string[]
  message?: string
}

export interface SeedButtonProps {
  /** Endpoint URL the button POSTs to. Defaults to `<routes.api>/seed` from the admin config. */
  endpoint?: string
}
