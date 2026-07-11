import type { CollectionBeforeChangeHook, Payload } from 'payload'
import type { PluginConfig } from 'svgo'

import type { IconData } from '../../types'

// Strip executable content from untrusted SVG uploads before they're stored and later inlined
// via dangerouslySetInnerHTML: <script> elements (svgo 4's `removeScripts`, renamed from 3.x's
// `removeScriptElement`) + on* event handlers. Also drop legacy editor attributes that survive
// preset-default and break React rendering when the root attrs are spread onto a JSX <svg>
// (`xml:space` → "Invalid DOM property") or mean nothing inline (`version`, `enable-background`).
const sanitizePlugins: PluginConfig[] = [
  'removeScripts',
  // elemSeparator '|': removeAttrs treats ':' as its element:attr:value separator, which would
  // split the literal attribute name `xml:space` — swap the separator so it matches verbatim.
  { name: 'removeAttrs', params: { attrs: ['on.*', 'xml:space', 'enable-background', 'version'], elemSeparator: '|' } },
]

// svgo has no builtin for javascript: URLs, so scrub (xlink:)href values from the serialized
// output as a final pass.
const stripDangerousUrls = (svg: string): string => svg.replace(/\s(?:xlink:)?href\s*=\s*(["'])\s*javascript:[^"']*\1/gi, '')

// The optimizer targets FILL glyphs: presentation attrs are stripped and fill="currentColor" is
// re-added, so a stroke-outline source (Lucide-style) renders its enclosed shapes as solid blobs.
const STROKE_WARNING = 'Warning: stroke-based icon detected — enclosed shapes will render filled. Use a fill-based glyph.'
const isStrokeBased = (svg: string): boolean => /fill\s*=\s*(["'])\s*none\s*\1/i.test(svg) && /\bstroke(?:-width)?\s*=/i.test(svg)

/**
 * Optimize and sanitize an uploaded SVG: run svgo (sanitize → preset-default → strip presentation
 * attrs → re-add `currentColor` fill/stroke so the icon themes with CSS color), tighten the
 * `viewBox` to the real path bounds, and store the result as `svgString` for inline rendering.
 *
 * svgo + svg-path-bbox are imported dynamically so they never land in a frontend/edge bundle —
 * this only runs server-side when an SVG is actually uploaded. On failure the raw upload is still
 * stored (never optimized/inlined) and the `optimized` field carries the error so the doc shows it.
 */
export const formatSvg = async (icon: IconData, svgData: Buffer, logger: Payload['logger']): Promise<IconData> => {
  try {
    const [{ optimize }, { svgPathBbox }] = await Promise.all([import('svgo'), import('svg-path-bbox')])

    const svg = svgData.toString('utf-8')
    const originalSize = svgData.length

    const strokeBased = isStrokeBased(svg)
    if (strokeBased) logger.warn(`[payload-icons] ${STROKE_WARNING}`)
    // Prefix the report field so the editor sees the warning on the doc, not just in the server log.
    const report = (msg: string): string => (strokeBased ? `${STROKE_WARNING} ${msg}` : msg)

    const hasTransforms = svg.includes('transform=')
    const hasClipPaths = svg.includes('clip-path=') || svg.includes('<clipPath')
    if (hasTransforms || hasClipPaths) {
      logger.warn({
        msg: '[payload-icons] Unsupported SVG features; skipping optimization (scripts still stripped)',
        hasClipPaths,
        hasTransforms,
      })
      // Even when we skip optimization we MUST strip scripts/event handlers, because svgString is
      // later inlined via dangerouslySetInnerHTML for every visitor.
      const sanitized = stripDangerousUrls(optimize(svg, { multipass: false, plugins: sanitizePlugins }).data)
      return { ...icon, optimized: report('Skipped optimization (transform/clip-path present); scripts stripped'), svgString: sanitized }
    }

    const optimized = optimize(svg, {
      path: 'input.svg',
      multipass: true,
      plugins: [
        // Strip <script> elements + on* handlers first so nothing downstream re-introduces them.
        ...sanitizePlugins,
        'preset-default',
        'convertStyleToAttrs',
        'removeDimensions',
        {
          name: 'removeAttrs',
          params: {
            attrs: [
              'fill',
              'stroke',
              'stroke-width',
              'stroke-linecap',
              'stroke-linejoin',
              'stroke-miterlimit',
              'stroke-dasharray',
              'stroke-dashoffset',
            ],
          },
        },
        { name: 'cleanupIds', params: { minify: true, remove: false } },
        { name: 'mergePaths', params: { force: false, noSpaceAfterFlags: true } },
        { name: 'cleanupNumericValues', params: { floatPrecision: 1, leadingZero: true } },
        { name: 'removeUnknownsAndDefaults', params: { keepAriaAttrs: true, keepDataAttrs: true, keepRoleAttr: true } },
        // Re-add currentColor so the icon inherits CSS `color` on the frontend (after the
        // presentation attrs above were stripped).
        { name: 'addAttributesToSVGElement', params: { attributes: [{ fill: 'currentColor' }, { stroke: 'currentColor' }] } },
        { name: 'convertTransform', params: { convertToShorts: true, degPrecision: 1, floatPrecision: 1, transformPrecision: 1 } },
        {
          name: 'convertPathData',
          params: {
            floatPrecision: 1,
            leadingZero: true,
            noSpaceAfterFlags: true,
            removeUseless: true,
            straightCurves: true,
            transformPrecision: 1,
          },
        },
        {
          name: 'sortAttrs',
          params: {
            order: [
              'id',
              'class',
              'style',
              'x',
              'y',
              'width',
              'height',
              'viewBox',
              'fill',
              'stroke',
              'stroke-width',
              'stroke-linecap',
              'stroke-linejoin',
              'stroke-miterlimit',
              'stroke-dasharray',
              'stroke-dashoffset',
              'd',
              'transform',
            ],
          },
        },
      ],
      js2svg: { pretty: true, indent: 2, eol: 'lf' },
    })

    let svgStr = optimized.data

    svgStr = svgStr.replace(/viewBox="([^"]+)"/g, (_match, viewBox) => {
      const coords = viewBox
        .split(' ')
        .map((coord: string) => (Number.isNaN(parseFloat(coord)) ? coord : parseFloat(coord).toFixed(1)))
        .join(' ')
      return `viewBox="${coords}"`
    })

    const paths = Array.from(svgStr.matchAll(/<path[^>]*d="([^"]+)"/g))

    if (paths.length) {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      for (const [, d] of paths) {
        if (!d) continue
        try {
          const [x1, y1, x2, y2] = svgPathBbox(d)
          minX = Math.min(minX, x1)
          minY = Math.min(minY, y1)
          maxX = Math.max(maxX, x2)
          maxY = Math.max(maxY, y2)
        } catch (e) {
          logger.warn({ msg: '[payload-icons] Failed to calculate path bounds', err: e })
        }
      }

      if (minX !== Infinity && minY !== Infinity && maxX !== -Infinity && maxY !== -Infinity) {
        const width = maxX - minX
        const height = maxY - minY

        // Square the viewBox around the glyph's center so icons share a consistent box.
        const side = Math.max(width, height)
        const centerX = minX + width / 2
        const centerY = minY + height / 2
        const newViewBox = `${(centerX - side / 2).toFixed(1)} ${(centerY - side / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`

        svgStr = svgStr.includes('viewBox=')
          ? svgStr.replace(/viewBox="[^"]+"/, `viewBox="${newViewBox}"`)
          : svgStr.replace('<svg', `<svg viewBox="${newViewBox}"`)
      }
    }

    svgStr = stripDangerousUrls(svgStr)

    const finalSize = Buffer.from(svgStr).length
    const reduction = originalSize - finalSize
    const reductionPercentage = ((reduction / originalSize) * 100).toFixed(1)
    const optimizedString = `SVG optimized: ${originalSize} to ${finalSize} bytes (${reductionPercentage}% reduction)`
    logger.info(`[payload-icons] ${optimizedString}`)

    return { ...icon, filesize: finalSize, optimized: report(optimizedString), svgString: svgStr }
  } catch (error) {
    logger.error({ msg: '[payload-icons] Error processing SVG', err: error })
    // Surface the failure on the doc itself — both output fields are condition-hidden when empty,
    // so a silent return would look like a normal save while the icon never renders.
    return { ...icon, optimized: `Optimization failed: ${error instanceof Error ? error.message : String(error)} — icon will not render.` }
  }
}

/** `beforeChange` hook: when an SVG file is uploaded (create or update), optimize + sanitize it
 *  and fold `svgString`/`optimized` into the doc. A no-op for changes that carry no new file. */
export const formatSVGHook: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation === 'create' || operation === 'update') {
    if (data?.filename && req.file) {
      try {
        return await formatSvg(data, req.file.data, req.payload.logger)
      } catch (error) {
        req.payload.logger.warn({ msg: '[payload-icons] Error in formatSVGHook', err: error })
        return data
      }
    }
  }
  return data
}
