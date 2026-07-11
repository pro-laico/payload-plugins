/** Parsed `payload-icons-scan` command-line arguments. */
export interface ParsedArgs {
  roots: string[]
  out?: string
  components: string[]
  extensions: string[]
  ignore: string[]
  help: boolean
  invalid: boolean
}
