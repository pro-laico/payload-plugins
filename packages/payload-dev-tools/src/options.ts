export const devToolsEnabled = (enabled?: boolean): boolean => enabled ?? process.env.NODE_ENV === 'development'
