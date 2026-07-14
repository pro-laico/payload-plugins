import type { Field } from 'payload'

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
    if (field.type === 'tabs')
      for (const tab of field.tabs) {
        if ('name' in tab && tab.name) continue
        const hit = findTopLevelField(tab.fields, name)
        if (hit) return hit
      }
  }
  return undefined
}
