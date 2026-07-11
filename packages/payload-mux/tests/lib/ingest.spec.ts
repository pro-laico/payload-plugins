import { describe, expect, it } from 'vitest'
import { resolveNewAssetSettings } from '../../src/lib/ingest'

describe('resolveNewAssetSettings', () => {
  it('defaults to public when nothing is configured', () => {
    expect(resolveNewAssetSettings()).toEqual({ playback_policy: ['public'] })
  })

  it('uses the plugin-configured policy (so seeded videos match admin uploads)', () => {
    expect(resolveNewAssetSettings({ playback_policy: ['signed'] })).toEqual({ playback_policy: ['signed'] })
  })

  it('lets a per-call playbackPolicy override the configured one', () => {
    expect(resolveNewAssetSettings({ playback_policy: ['signed'] }, 'public')).toEqual({ playback_policy: ['public'] })
  })

  it('applies a per-call policy even with no config', () => {
    expect(resolveNewAssetSettings(undefined, 'signed')).toEqual({ playback_policy: ['signed'] })
  })

  it('preserves other configured new_asset_settings', () => {
    const out = resolveNewAssetSettings({ playback_policy: ['signed'], mp4_support: 'standard' }, 'public')
    expect(out).toEqual({ playback_policy: ['public'], mp4_support: 'standard' })
  })
})
