/** The shared gate: explicit option wins, otherwise dev-only. */
export const devToolsEnabled = (enabled?: boolean): boolean => enabled ?? process.env.NODE_ENV === 'development'
