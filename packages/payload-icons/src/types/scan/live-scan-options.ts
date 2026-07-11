export interface LiveScanOptions {
  /** Directories/files to scan, relative to {@link cwd} or absolute. @default ['src', 'app'] */
  roots?: string[]
  /** Working directory. @default process.cwd() */
  cwd?: string
  /** JSX tag names treated as icon usages. @default ['Icon'] */
  components?: string[]
  /** File extensions (without the dot) to read. @default ['tsx', 'jsx', 'ts', 'js', 'mdx'] */
  extensions?: string[]
  /** Directory names to skip. @default ['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.turbo'] */
  ignore?: string[]
}
