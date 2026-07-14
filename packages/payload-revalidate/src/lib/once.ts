export const createOnce = (): ((key: string) => boolean) => {
  const seen = new Set<string>()
  return (key: string): boolean => {
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }
}
