import type { CollectionConfig } from 'payload'
import { formatSVGHook } from '../hooks/formatSVG'
import { defaultAdminAccess, defaultReadAccess } from '../lib/defaultAccess'
import { iconNameFromFilename } from '../lib/derive'
import { mergeHooks } from '../lib/mergeHooks'
import type { IconCollectionOverrides, IconDoc } from '../types'

/** The default slug for the icon collection. */
export const ICON_SLUG = 'icon'

/**
 * Build the `Icon` upload collection: accepts `image/svg+xml` uploads, optimizes + sanitizes
 * each SVG on `beforeChange` (`formatSVGHook`), and stores the result as `svgString` for inline
 * frontend rendering. Public read by default; logged-in-admin writes.
 *
 * Pass {@link IconsPluginOptions} to append fields/hooks, override access, or rename the slug —
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
    admin: { group: adminGroup, useAsTitle: 'filename', defaultColumns: ['filename', 'filesize', 'updatedAt'] },
    // Payload blocks SVG uploads by default (they're on its restricted-types list). This is an
    // SVG-only collection and `formatSVGHook` sanitizes every file (scripts / on* handlers /
    // javascript: URLs stripped) before storage, so we opt in. `mimeTypes` still scopes uploads
    // to SVG, and the opt-in stays overridable via `options.upload`.
    upload: { mimeTypes: ['image/svg+xml'], allowRestrictedFileTypes: true, ...upload },
    // The virtual `name` field below derives from `filename` on read. A consumer using `select`
    // could deselect that input, so pin it — `name` is always populated, in REST/GraphQL/Local API.
    forceSelect: { filename: true },
    fields: [
      { name: 'optimized', type: 'text', admin: { readOnly: true, condition: (data) => Boolean(data?.optimized) } },
      {
        name: 'svgString',
        type: 'code',
        admin: {
          language: 'xml',
          condition: (data) => Boolean(data?.svgString),
          editorOptions: { wordWrap: 'off', scrollBeyondLastLine: false },
        },
      },
      // Computed, never stored — so API consumers get the icon's name (filename without `.svg`)
      // without rebuilding it client-side. Pure string work only; no I/O in `afterRead`.
      {
        name: 'name',
        type: 'text',
        virtual: true,
        admin: { hidden: true },
        hooks: { afterRead: [({ data }) => iconNameFromFilename((data as IconDoc | undefined)?.filename)] },
      },
      ...fields,
    ],
    hooks: mergeHooks({ beforeChange: [formatSVGHook] }, hooks),
  }
}
