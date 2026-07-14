export const isNotFound = (err: unknown): boolean =>
  //TODO: replace `as` cast with proper typing
  (err as { status?: number })?.status === 404 || (err instanceof Error && err.name === 'NotFound')
