/**
 * A manual dependency rule — the escape hatch for data flows the automation can't see
 * (content rendered downstream of an untagged read). When a doc in `on` changes, the
 * listed tags are busted too, optionally gated on which top-level fields changed.
 *
 * @example
 * ```ts
 * // FAQ text is baked into service pages by a build step the walk can't observe:
 * rules: [{ on: 'faqs', bust: ['services'], whenFields: ['question', 'answer'] }]
 * ```
 */
export interface DependencyRule {
  /** Source collection slug that triggers the rule. */
  on: string
  /** Tags to bust when it fires (built by hand or with {@link tags}). */
  bust: string[]
  /** Only fire when one of these top-level fields changed (deletes always fire). */
  whenFields?: string[]
}
