import type Mux from '@mux/mux-node'
import type { CollectionConfig, TextField } from 'payload'

import { isAllowed } from '../lib/isAllowed'
import type { MuxAdminThumbnail, ResolvedMuxVideoOptions } from '../types'
import { signableUrlAfterRead } from '../hooks/field/afterRead'
import { getAfterDeleteHook } from '../hooks/collection/afterDelete'
import { getBeforeChangeHook } from '../hooks/collection/beforeChange'
import { getBeforeValidateHook } from '../hooks/collection/beforeValidate'

const C = '@pro-laico/payload-mux/components'

const thumbnailCell = (mode: MuxAdminThumbnail): string | undefined => {
  if (mode === 'image') return `${C}/MuxVideoImageCell#MuxVideoImageCell`
  if (mode === 'none') return undefined
  return `${C}/MuxVideoGifCell#MuxVideoGifCell`
}

const signableUrlField = (
  mux: Mux,
  options: ResolvedMuxVideoOptions,
  name: string,
  label: string,
  type: 'video' | 'thumbnail' | 'gif',
  buildUrl: (playbackId: string) => URL,
): TextField => ({
  name,
  label,
  type: 'text',
  virtual: true,
  admin: { hidden: true },
  hooks: { afterRead: [signableUrlAfterRead(mux, options, type, buildUrl)] },
})

/** The slug the collection registers under unless `collections.muxVideo.slug` renames it. */
export const MUX_VIDEO_SLUG = 'mux-video'

/** The `mux-video` collection: the Mux fields, the hooks that keep them in sync with the asset, and
 * the selects the admin list cells need. `forceSelect` is what those cells actually need, and it
 * holds however you fetch. A `collections.muxVideo` override merges over the whole thing. */
export const MuxVideo = (mux: Mux, options: ResolvedMuxVideoOptions): CollectionConfig => ({
  slug: MUX_VIDEO_SLUG,
  labels: { singular: 'Video', plural: 'Videos' },
  custom: { seedAsset: { sourceField: 'source' } },
  access: { read: ({ req }) => isAllowed(options.options.access.read, req) },
  admin: {
    group: 'Assets',
    enableListViewSelectAPI: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'muxUploader', 'duration'],
  },
  forceSelect: { playbackOptions: true, title: true },
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
      admin: {
        components: { Field: `${C}/MuxUploaderField#MuxUploaderField`, Cell: thumbnailCell(options.collections.muxVideo.options.thumbnail) },
      },
    },
    { name: 'source', type: 'json', admin: { hidden: true, disableListColumn: true, disableBulkEdit: true } },
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      required: true,
      unique: true,
      admin: { description: 'A unique title for this video that will help you identify it later.' },
    },
    { name: 'assetId', type: 'text', index: true, admin: { readOnly: true, condition: (data) => data.assetId } },
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
          (id) => new URL(`https://image.mux.com/${id}/thumbnail.${options.options.posterExtension}`),
        ),
        signableUrlField(
          mux,
          options,
          'gifUrl',
          'Gif URL',
          'gif',
          (id) => new URL(`https://image.mux.com/${id}/animated.${options.options.animatedGifExtension}`),
        ),
      ],
    },
  ],
})
