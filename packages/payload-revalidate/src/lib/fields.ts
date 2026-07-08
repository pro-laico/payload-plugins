import type { Field } from 'payload'

/**
 * Find a named field that is top-level in the DATA shape, looking through the
 * presentational wrappers that don't nest data: `row`, `collapsible`, and unnamed tabs.
 * Named tabs and groups DO nest data, so they're not descended — a field inside them
 * isn't `doc[name]`.
 */
/** Every field name that is top-level in the DATA shape (through `row`/`collapsible`/
 *  unnamed tabs; named tabs and groups count as ONE name — they nest their contents).
 *  Feeds the dev map's per-field blast-radius table. */
export const topLevelFieldNames = (fields: Field[] | undefined): string[] => {
  const names: string[] = []
  for (const field of fields ?? []) {
    if ('name' in field && field.name) {
      names.push(field.name)
      continue
    }
    if (field.type === 'row' || field.type === 'collapsible') names.push(...topLevelFieldNames(field.fields))
    if (field.type === 'tabs')
      for (const tab of field.tabs) names.push(...('name' in tab && tab.name ? [tab.name] : topLevelFieldNames(tab.fields)))
  }
  return [...new Set(names)]
}

/** Top-level fields whose VALUES need special handling in the write-side diff: relationship/
 *  upload values are normalized to ids (depth-asymmetric between `doc` and `previousDoc`),
 *  joins are derived query results and excluded. Same wrapper traversal as above. */
export const changeDetectionFields = (fields: Field[] | undefined): { relations: string[]; joins: string[] } => {
  const relations: string[] = []
  const joins: string[] = []
  const walk = (list: Field[] | undefined): void => {
    for (const field of list ?? []) {
      if ('name' in field && field.name) {
        if (field.type === 'relationship' || field.type === 'upload') relations.push(field.name)
        if (field.type === 'join') joins.push(field.name)
        continue
      }
      if (field.type === 'row' || field.type === 'collapsible') walk(field.fields)
      if (field.type === 'tabs') for (const tab of field.tabs) if (!('name' in tab && tab.name)) walk(tab.fields)
    }
  }
  walk(fields)
  return { relations: [...new Set(relations)], joins: [...new Set(joins)] }
}

export const findTopLevelField = (fields: Field[] | undefined, name: string): Field | undefined => {
  for (const field of fields ?? []) {
    if ('name' in field && field.name === name) return field
    if (field.type === 'row' || field.type === 'collapsible') {
      const hit = findTopLevelField(field.fields, name)
      if (hit) return hit
    }
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        if ('name' in tab && tab.name) continue
        const hit = findTopLevelField(tab.fields, name)
        if (hit) return hit
      }
    }
  }
  return undefined
}
