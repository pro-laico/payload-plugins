import type Mux from '@mux/mux-node'
import type { CollectionConfig, Field } from 'payload'
import { getAfterDeleteHook } from '../hooks/afterDelete'
import { getBeforeChangeHook } from '../hooks/beforeChange'
import { getBeforeValidateHook } from '../hooks/beforeValidate'
import { isAllowed } from '../lib/isAllowed'
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

/** Build one virtual, read-only URL field (`playbackUrl` / `posterUrl` / `gifUrl`). On read it
 *  builds the Mux URL from the sibling `playbackId`, stamps the poster `time` for thumbnail/gif,
 *  and signs it when the policy is `signed`. Returns null until a playback id exists. */
const signableUrlField = (
  mux: Mux,
  options: MuxVideoPluginOptions,
  name: string,
  label: string,
  type: 'video' | 'thumbnail' | 'gif',
  buildUrl: (playbackId: string) => URL,
): Field => ({
  name,
  label,
  type: 'text',
  virtual: true,
  admin: { hidden: true },
  hooks: {
    afterRead: [
      async ({ data, siblingData }) => {
        const playbackId = siblingData?.playbackId
        if (!playbackId) return null
        const posterTimestamp = type !== 'video' && typeof data?.posterTimestamp === 'number' ? data.posterTimestamp : undefined
        const url = buildUrl(playbackId)
        if (posterTimestamp !== undefined) url.searchParams.set('time', posterTimestamp.toString())
        await signIfNeeded(mux, options, url, playbackId, siblingData.playbackPolicy, type, posterTimestamp)
        return url.toString()
      },
    ],
  },
})

/** The Videos collection: an uploader field, identifying metadata Mux fills in, and a
 *  `playbackOptions` array whose virtual fields resolve to signed-or-public Mux URLs. */
export const MuxVideo = (mux: Mux, options: MuxVideoPluginOptions): CollectionConfig => ({
  slug: (options.extendCollection as string) ?? 'mux-video',
  labels: { singular: 'Video', plural: 'Videos' },
  // Declares this as a `@pro-laico/payload-seed` asset collection: instead of uploading bytes,
  // the seed engine hands a doc's `_file` to the `source` field below, whose beforeValidate hook
  // uploads it to Mux. Plain config — payload-mux doesn't import the seed package.
  custom: { seedAsset: { sourceField: 'source' } },
  access: { read: ({ req }) => isAllowed(options, req) },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'muxUploader', 'duration'] },
  hooks: {
    afterDelete: [getAfterDeleteHook(mux)],
    beforeValidate: [getBeforeValidateHook(mux, options)],
    beforeChange: [getBeforeChangeHook(mux)],
  },
  fields: [
    {
      name: 'muxUploader',
      label: 'Video Preview',
      type: 'ui',
      admin: { components: { Field: `${C}/MuxUploaderField#MuxUploaderField`, Cell: thumbnailCell(options.adminThumbnail) } },
    },
    // Transient server-side ingest input (a local path / URL, or `{ file|url, playbackPolicy,
    // posterTimestamp }`). The beforeValidate hook uploads it to Mux and strips it — never
    // persisted. Lets a video be created from a file without the admin's client-side upload.
    { name: 'source', type: 'json', admin: { hidden: true, disableListColumn: true, disableBulkEdit: true } },
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      required: true,
      unique: true,
      admin: { description: 'A unique title for this video that will help you identify it later.' },
    },
    // Not `required`: it's filled by the beforeValidate (server-side ingest) / beforeChange
    // (admin upload) hooks before the row is written. Marking it required would reject a
    // create that supplies a `source` instead of an already-resolved `assetId`.
    // Indexed: the webhook looks a doc up by assetId on every Mux event.
    { name: 'assetId', type: 'text', index: true, admin: { readOnly: true, condition: (data) => data.assetId } },
    // Encoding lifecycle, hook-written: 'preparing' until Mux reports the asset ready (short
    // poll or webhook), 'ready' once playable, 'errored' when Mux rejects it (see `error`).
    // Not required — docs created before this field existed have no status.
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Preparing', value: 'preparing' },
        { label: 'Ready', value: 'ready' },
        { label: 'Errored', value: 'errored' },
      ],
      admin: { position: 'sidebar', readOnly: true, condition: (data) => data.status },
    },
    // Mux's error messages when `status` is 'errored'; surfaced by the uploader field.
    { name: 'error', type: 'text', admin: { hidden: true, readOnly: true } },
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
        return siblingData.duration > value || 'Poster timestamp must be less than the video duration.'
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
        // Both required: the pair is always written together, and it tightens the generated types.
        { name: 'playbackId', label: 'Playback ID', type: 'text', required: true, admin: { readOnly: true } },
        {
          name: 'playbackPolicy',
          label: 'Playback Policy',
          type: 'select',
          required: true,
          options: [
            { label: 'signed', value: 'signed' },
            { label: 'public', value: 'public' },
          ],
          admin: { readOnly: true },
        },
        signableUrlField(mux, options, 'playbackUrl', 'Playback URL', 'video', (id) => new URL(`https://stream.mux.com/${id}.m3u8`)),
        signableUrlField(
          mux,
          options,
          'posterUrl',
          'Poster URL',
          'thumbnail',
          (id) => new URL(`https://image.mux.com/${id}/thumbnail.${options.posterExtension ?? 'png'}`),
        ),
        signableUrlField(
          mux,
          options,
          'gifUrl',
          'Gif URL',
          'gif',
          (id) => new URL(`https://image.mux.com/${id}/animated.${options.animatedGifExtension ?? 'gif'}`),
        ),
      ],
    },
  ],
})
