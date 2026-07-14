export type Size = 'sm' | 'md' | 'lg'
export type StageSelection = { testKey: string; versionId: string }
export type View = 'main' | 'info' | 'seed' | 'pages' | 'tests' | 'settings'
export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
export type Settings = { corner: Corner; size: Size }
