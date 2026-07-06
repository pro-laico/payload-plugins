import type { Payload, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { createActivateIconSetEndpoint } from './activateIconSet'
import { createDevEndpoint } from './dev'
import { createDraftEndpoint } from './draft'
import { createStageEndpoint } from './stage'

// The draft endpoint lazy-imports `next/headers`; outside a real Next request scope
// `draftMode()` throws, so stand in a minimal in-memory implementation.
const draftState = { isEnabled: false }
vi.mock('next/headers', () => ({
  draftMode: async () => ({
    get isEnabled() {
      return draftState.isEnabled
    },
    enable: () => {
      draftState.isEnabled = true
    },
    disable: () => {
      draftState.isEnabled = false
    },
  }),
}))

const barePayload = (): Payload =>
  ({
    config: { custom: {}, collections: [], globals: [], routes: { admin: '/admin' } },
    count: async () => ({ totalDocs: 0 }),
  }) as unknown as Payload

const request = (url: string, accept = '*/*'): PayloadRequest =>
  ({ url, headers: new Headers({ accept }), payload: barePayload() }) as unknown as PayloadRequest

// Vitest runs with NODE_ENV=test, so the default gate (dev-only) is CLOSED here — which is
// exactly what we assert first; `enabled: true` opens it for the behavior tests.
describe('GET /api/dev', () => {
  it('404s outside development by default', async () => {
    const res = await createDevEndpoint({ devRoute: '/dev' }).handler(request('http://x/api/dev'))
    expect(res.status).toBe(404)
  })

  it('serves the JSON snapshot when enabled', async () => {
    const res = await createDevEndpoint({ enabled: true, devRoute: '/dev' }).handler(request('http://x/api/dev'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { plugins: Record<string, boolean>; adminRoute: string }
    expect(body.adminRoute).toBe('/admin')
    expect(body.plugins).toEqual({ seed: false, images: false, icons: false, fonts: false, mux: false })
  })

  it('redirects browsers to the dev pages, and ?format=json overrides it', async () => {
    const browser = await createDevEndpoint({ enabled: true, devRoute: '/dev' }).handler(
      request('http://x/api/dev', 'text/html,application/xhtml+xml'),
    )
    expect(browser.status).toBe(307)
    expect(browser.headers.get('location')).toBe('/dev')

    const json = await createDevEndpoint({ enabled: true, devRoute: '/dev' }).handler(request('http://x/api/dev?format=json', 'text/html'))
    expect(json.status).toBe(200)
    expect(json.headers.get('content-type')).toContain('application/json')
  })
})

describe('GET /api/dev/stage', () => {
  const stage = (enabled?: boolean) => createStageEndpoint({ enabled, devRoute: '/dev' })

  it('404s outside development by default', async () => {
    const res = await stage(undefined).handler(request('http://x/api/dev/stage?test=a&version=b'))
    expect(res.status).toBe(404)
  })

  it("sets the selection cookie and redirects to the test's page by default", async () => {
    const res = await stage(true).handler(request('http://x/api/dev/stage?test=hero&version=bold'))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/dev/tests/hero')
    expect(res.headers.get('set-cookie')).toBe(`pdt-stage=${encodeURIComponent('hero:bold')}; Path=/; SameSite=Lax`)
  })

  it('honors an explicit `to`', async () => {
    const res = await stage(true).handler(request('http://x/api/dev/stage?test=hero&version=bold&to=/pricing'))
    expect(res.headers.get('location')).toBe('/pricing')
  })

  it('clears the cookie with ?clear (and when test/version are missing)', async () => {
    for (const url of ['http://x/api/dev/stage?clear=1', 'http://x/api/dev/stage?test=hero']) {
      const res = await stage(true).handler(request(url))
      expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
      expect(res.headers.get('location')).toBe('/')
    }
  })

  it('rejects non-path redirect targets (no open redirect)', async () => {
    for (const to of ['https://evil.test', '//evil.test']) {
      const res = await stage(true).handler(request(`http://x/api/dev/stage?test=a&version=b&to=${encodeURIComponent(to)}`))
      expect(res.headers.get('location')).toBe('/')
    }
  })

  it('targets a chrome-override cookie with ?slot and redirects home (site-wide swap)', async () => {
    const res = await stage(true).handler(request('http://x/api/dev/stage?slot=header&test=site-header&version=mega'))
    expect(res.headers.get('set-cookie')).toBe(`pdt-chrome-header=${encodeURIComponent('site-header:mega')}; Path=/; SameSite=Lax`)
    expect(res.headers.get('location')).toBe('/')

    const clear = await stage(true).handler(request('http://x/api/dev/stage?slot=footer&clear=1'))
    expect(clear.headers.get('set-cookie')).toContain('pdt-chrome-footer=;')
  })
})

describe('GET /api/dev/draft', () => {
  it('404s outside development by default', async () => {
    const res = await createDraftEndpoint(undefined).handler(request('http://x/api/dev/draft'))
    expect(res.status).toBe(404)
  })

  it('reports the current state without params', async () => {
    draftState.isEnabled = false
    const res = await createDraftEndpoint(true).handler(request('http://x/api/dev/draft'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ enabled: false })
  })

  it('flips draft mode with ?enable and reports the new state', async () => {
    draftState.isEnabled = false
    const on = await createDraftEndpoint(true).handler(request('http://x/api/dev/draft?enable=1'))
    expect(await on.json()).toEqual({ enabled: true })
    expect(draftState.isEnabled).toBe(true)

    const off = await createDraftEndpoint(true).handler(request('http://x/api/dev/draft?enable=off'))
    expect(await off.json()).toEqual({ enabled: false })
    expect(draftState.isEnabled).toBe(false)
  })

  it('400s on an unrecognized enable value', async () => {
    const res = await createDraftEndpoint(true).handler(request('http://x/api/dev/draft?enable=maybe'))
    expect(res.status).toBe(400)
  })

  it('redirects with `to` (same-site paths only)', async () => {
    const res = await createDraftEndpoint(true).handler(request('http://x/api/dev/draft?enable=1&to=/pricing'))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/pricing')

    const evil = await createDraftEndpoint(true).handler(request('http://x/api/dev/draft?to=//evil.test'))
    expect(evil.headers.get('location')).toBe('/')
  })
})

describe('POST /api/dev/icons/activate', () => {
  const activateRequest = ({
    custom = {},
    body = {} as unknown,
    update = vi.fn(),
  } = {}): { req: PayloadRequest; update: ReturnType<typeof vi.fn> } => ({
    req: {
      url: 'http://x/api/dev/icons/activate',
      headers: new Headers(),
      json: async () => body,
      payload: { config: { custom, collections: [], globals: [] }, update } as unknown as Payload,
    } as unknown as PayloadRequest,
    update,
  })

  it('404s outside development by default', async () => {
    const { req } = activateRequest()
    expect((await createActivateIconSetEndpoint(undefined).handler(req)).status).toBe(404)
  })

  it('400s without payload-icons or without an id', async () => {
    const noIcons = activateRequest({ body: { id: 1 } })
    expect((await createActivateIconSetEndpoint(true).handler(noIcons.req)).status).toBe(400)

    const noId = activateRequest({ custom: { payloadIcons: { iconSetSlug: 'iconSet' } } })
    expect((await createActivateIconSetEndpoint(true).handler(noId.req)).status).toBe(400)
  })

  it('publishes the chosen set as active', async () => {
    const { req, update } = activateRequest({ custom: { payloadIcons: { iconSetSlug: 'iconSet' } }, body: { id: 7 } })
    const res = await createActivateIconSetEndpoint(true).handler(req)
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'iconSet', id: 7, draft: false, data: { active: true, _status: 'published' } }),
    )
  })
})
