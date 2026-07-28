/** The single gate every surface in this plugin asks.
 *
 * `enabled` can turn the dev tools OFF anywhere, and ON anywhere except a production build — where
 * the answer is always no, whatever you pass. That clamp is what makes the rest of the plugin
 * simple: `/dev` cannot be rendered by `next build`, so its live database read can never be
 * prerendered, and the snapshot can never report the build machine's counts to a deployed site.
 *
 * `NODE_ENV !== 'production'` rather than `=== 'development'` so tests and integration harnesses can
 * still opt in — they run under `test`, and nothing they render ships anywhere. */
export const devEnabled = (enabled?: boolean): boolean =>
  (enabled ?? process.env.NODE_ENV === 'development') && process.env.NODE_ENV !== 'production'
