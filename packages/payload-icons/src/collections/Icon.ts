import type { CollectionConfig } from 'payload'
import { formatSVGHook } from '../hooks/formatSVG'
import { defaultAdminAccess, defaultReadAccess } from '../lib/defaultAccess'
import { mergeHooks } from '../lib/mergeHooks'
import type { IconCollectionOverrides } from '../types'

/** The default slug for the icon collection. */
export const ICON_SLUG = 'icon'

/** Admin import-map paths for the theme-aware inline previews (the stored file `<img>`s as black — invisible on the dark theme). */
const IconPreviewFieldPath = '@pro-laico/payload-icons/admin/iconPreview#IconPreviewField'
const IconPreviewCellPath = '@pro-laico/payload-icons/admin/iconPreview#IconPreviewCell'

/**
 * Build the `Icon` upload collection: accepts `image/svg+xml` uploads, optimizes + sanitizes
 * each SVG on `beforeChange` (`formatSVGHook`), and stores the result as `svgString` for inline
 * frontend rendering. Public read by default; logged-in-admin writes.
 *
 * Pass {@link IconCollectionOverrides} to append fields/hooks, override access, or rename the slug —
 * additions stack on top of the defaults.
 */
export const Icon = (options: IconCollectionOverrides = {}): CollectionConfig => {
  const { slug = ICON_SLUG, adminGroup = 'Assets', access, fields = [], hooks, upload } = options

  return {
    slug,
    labels: { singular: 'Icon', plural: 'Icons' },
    access: {
      read: access?.read ?? defaultReadAccess,
      create: access?.create ?? defaultAdminAccess,
      update: access?.update ?? defaultAdminAccess,
      delete: access?.delete ?? defaultAdminAccess,
    },
    admin: { group: adminGroup, useAsTitle: 'filename', defaultColumns: ['filename', 'svgString', 'filesize', 'updatedAt'] },
    // Payload blocks SVG uploads by default (they're on its restricted-types list). This is an
    // SVG-only collection and `formatSVGHook` sanitizes every file (scripts / on* handlers /
    // javascript: URLs stripped) before storage, so we opt in. `mimeTypes` still scopes uploads
    // to SVG, and the opt-in stays overridable via `options.upload`.
    upload: { mimeTypes: ['image/svg+xml'], allowRestrictedFileTypes: true, ...upload },
    fields: [
      {
        name: 'iconPreview',
        type: 'ui',
        admin: { components: { Field: IconPreviewFieldPath }, condition: (data) => Boolean(data?.svgString) },
      },
      { name: 'optimized', type: 'text', admin: { readOnly: true, condition: (data) => Boolean(data?.optimized) } },
      {
        name: 'svgString',
        type: 'code',
        admin: {
          components: { Cell: IconPreviewCellPath },
          language: 'xml',
          // Read-only: a direct edit would bypass formatSVGHook's sanitization (only runs on file
          // uploads) and the string is later inlined via dangerouslySetInnerHTML — re-upload to change.
          readOnly: true,
          condition: (data) => Boolean(data?.svgString),
          editorOptions: { wordWrap: 'off', scrollBeyondLastLine: false },
        },
      },
      ...fields,
    ],
    hooks: mergeHooks({ beforeChange: [formatSVGHook] }, hooks),
  }
}
