/** True when a delete failed because the doc is already gone — the goal state, not a problem.
 *  Happens routinely when another path deleted it first (e.g. a seed run clears `fontOriginal`
 *  directly, then clearing `font` fires this cascade at the same ids). */
export const isNotFound = (err: unknown): boolean =>
  (err as { status?: number })?.status === 404 || (err instanceof Error && err.name === 'NotFound')
