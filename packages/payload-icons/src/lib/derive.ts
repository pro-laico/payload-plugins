// Pure, cheap derivation from an icon doc — safe to run in an `afterRead` hook (no I/O).

/** An icon's name: its filename without the directory or `.svg` extension
 *  (`brand/arrow-right.svg` → `arrow-right`). */
export const iconNameFromFilename = (filename?: string | null): string | null =>
  filename ? filename.replace(/^.*[\\/]/, '').replace(/\.svg$/i, '') : null
