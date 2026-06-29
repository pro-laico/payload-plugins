/** Resolve after `ms` milliseconds. */
export const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
