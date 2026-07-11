export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
export type Size = 'sm' | 'md' | 'lg'
export type Settings = { corner: Corner; size: Size }
export type View = 'main' | 'info' | 'seed' | 'pages' | 'tests' | 'settings'
export type StageSelection = { testKey: string; versionId: string }
