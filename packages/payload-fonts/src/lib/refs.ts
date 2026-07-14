export const refId = (ref: unknown): string | number | undefined => {
  if (ref && typeof ref === 'object') return (ref as { id?: string | number }).id //TODO: replace `as` cast with proper typing
  return (ref as string | number | null | undefined) ?? undefined //TODO: replace `as` cast with proper typing
}
