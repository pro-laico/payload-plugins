import { muxVideoPlugin } from '@pro-laico/payload-mux'
import type { Plugin } from 'payload'

// The project's plugin barrel — payload.config imports this array. No credentials are passed:
// the plugin reads them from the standard MUX_* env vars (MUX_TOKEN_ID, MUX_TOKEN_SECRET,
// MUX_WEBHOOK_SECRET), and cors_origin defaults to NEXT_PUBLIC_SERVER_URL. Pass options only
// to override (e.g. a custom env var name or playback policy).
export const plugins: Plugin[] = [muxVideoPlugin()]
