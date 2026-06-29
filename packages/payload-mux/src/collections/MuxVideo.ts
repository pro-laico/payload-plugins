import type Mux from '@mux/mux-node'
import type { CollectionConfig } from 'payload'
import { getAfterDeleteHook } from '../hooks/afterDelete'
import { getBeforeChangeHook } from '../hooks/beforeChange'
import { defaultAccess } from '../lib/defaultAccess'
import type { MuxVideoPluginOptions } from '../types'

const C = '@pro-laico/payload-mux/components'

/** Resolve the list-view Cell component for the configured `adminThumbnail` mode. */
const thumbnailCell = (mode: MuxVideoPluginOptions['adminThumbnail']): string | undefined => {
  if (mode === 'image') return `${C}/MuxVideoImageCell#MuxVideoImageCell`
  if (mode === 'none') return undefined
  return `${C}/MuxVideoGifCell#MuxVideoGifCell`
}

/** Sign a playback id for a given media `type` when the policy is `signed`, and append the
 *  token to `url`. A no-op for public playback. */
const signIfNeeded = async (
  mux: Mux,
  options: MuxVideoPluginOptions,
  url: URL,
  playbackId: string,
  policy: unknown,
  type: 'video' | 'thumbnail' | 'gif',
  posterTimestamp?: number,
): Promise<void> => {
  if (policy !== 'signed') return
  const params = typeof posterTimestamp === 'number' ? { time: posterTimestamp.toString() } : undefined
  const token = await mux.jwt.signPlaybackId(playbackId, { expiration: options.signedUrlOptions?.expiration ?? '1d', type, params })
  url.searchParams.set('token', token)
}

/** The Videos collection: an uploader field, identifying metadata Mux fills in, and a
 *  `playbackOptions` array whose virtual fields resolve to signed-or-public Mux URLs. */
export const MuxVideo = (mux: Mux, options: MuxVideoPluginOptions): CollectionConfig => ({
  slug: (options.extendCollection as string) ?? 'mux-video',
  labels: { singular: 'Video', plural: 'Videos' },
  access: { read: ({ req }) => options.access?.(req) ?? defaultAccess(req) },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'muxUploader', 'duration'] },
  hooks: {
    afterDelete: [getAfterDeleteHook(mux)],
    beforeChange: [getBeforeChangeHook(mux, (options.extendCollection as string) ?? 'mux-video')],
  },
  fields: [
    {
      name: 'muxUploader',
      label: 'Video Preview',
      type: 'ui',
      admin: { components: { Field: `${C}/MuxUploaderField#MuxUploaderField`, Cell: thumbnailCell(options.adminThumbnail) } },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      required: true,
      unique: true,
      admin: { description: 'A unique title for this video that will help you identify it later.' },
    },
    { name: 'assetId', type: 'text', required: true, admin: { readOnly: true, condition: (data) => data.assetId } },
    { name: 'duration', label: 'Duration', type: 'number', admin: { readOnly: true, condition: (data) => data.duration } },
    {
      name: 'posterTimestamp',
      type: 'number',
      label: 'Poster Timestamp',
      min: 0,
      admin: {
        description: 'A timestamp (in seconds) from the video to be used as the poster image. When unset, defaults to the middle of the video.',
        condition: (data) => data.duration,
        step: 0.25,
      },
      validate: (value: number | null | undefined, { siblingData }: { siblingData: Partial<{ duration: number }> }) => {
        if (!siblingData.duration || !value) return true
        return siblingData.duration >= value || 'Poster timestamp must be less than the video duration.'
      },
    },
    { name: 'aspectRatio', label: 'Aspect Ratio', type: 'text', admin: { readOnly: true, condition: (data) => data.aspectRatio } },
    { name: 'maxWidth', type: 'number', admin: { readOnly: true, condition: (data) => data.maxWidth } },
    { name: 'maxHeight', type: 'number', admin: { readOnly: true, condition: (data) => data.maxHeight } },
    {
      name: 'playbackOptions',
      type: 'array',
      admin: { readOnly: true, condition: (data) => !!data.playbackOptions },
      fields: [
        { name: 'playbackId', label: 'Playback ID', type: 'text', admin: { readOnly: true } },
        {
          name: 'playbackPolicy',
          label: 'Playback Policy',
          type: 'select',
          options: [
            { label: 'signed', value: 'signed' },
            { label: 'public', value: 'public' },
          ],
          admin: { readOnly: true },
        },
        {
          name: 'playbackUrl',
          label: 'Playback URL',
          type: 'text',
          virtual: true,
          admin: { hidden: true },
          hooks: {
            afterRead: [
              async ({ siblingData }) => {
                const playbackId = siblingData?.playbackId
                if (!playbackId) return null
                const url = new URL(`https://stream.mux.com/${playbackId}.m3u8`)
                await signIfNeeded(mux, options, url, playbackId, siblingData.playbackPolicy, 'video')
                return url.toString()
              },
            ],
          },
        },
        {
          name: 'posterUrl',
          label: 'Poster URL',
          type: 'text',
          virtual: true,
          admin: { hidden: true },
          hooks: {
            afterRead: [
              async ({ data, siblingData }) => {
                const playbackId = siblingData?.playbackId
                if (!playbackId) return null
                const posterTimestamp = data?.posterTimestamp
                const url = new URL(`https://image.mux.com/${playbackId}/thumbnail.${options.posterExtension ?? 'png'}`)
                if (typeof posterTimestamp === 'number') url.searchParams.set('time', posterTimestamp.toString())
                await signIfNeeded(mux, options, url, playbackId, siblingData.playbackPolicy, 'thumbnail', posterTimestamp)
                return url.toString()
              },
            ],
          },
        },
        {
          name: 'gifUrl',
          label: 'Gif URL',
          type: 'text',
          virtual: true,
          admin: { hidden: true },
          hooks: {
            afterRead: [
              async ({ data, siblingData }) => {
                const playbackId = siblingData?.playbackId
                if (!playbackId) return null
                const posterTimestamp = data?.posterTimestamp
                const url = new URL(`https://image.mux.com/${playbackId}/animated.${options.animatedGifExtension ?? 'gif'}`)
                if (typeof posterTimestamp === 'number') url.searchParams.set('time', posterTimestamp.toString())
                await signIfNeeded(mux, options, url, playbackId, siblingData.playbackPolicy, 'gif', posterTimestamp)
                return url.toString()
              },
            ],
          },
        },
      ],
    },
  ],
})
