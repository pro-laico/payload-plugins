import { muxVideoPlugin } from '@pro-laico/payload-mux'
import type { Plugin } from 'payload'

// The project's plugin barrel — payload.config imports this array. Credentials come from the
// environment; for local dev with no real Mux account, dummy values are enough to boot the
// config (uploads/playback obviously need a real token).
export const plugins: Plugin[] = [
  muxVideoPlugin({
    enabled: true,
    initSettings: {
      tokenId: process.env.MUX_TOKEN_ID || '',
      tokenSecret: process.env.MUX_TOKEN_SECRET || '',
      webhookSecret: process.env.MUX_WEBHOOK_SIGNING_SECRET || '',
    },
    uploadSettings: {
      cors_origin: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3051',
    },
  }),
]
