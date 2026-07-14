import type { AnyToken, FileToken, Ref, RegistryCollectionSlug, RegistryCollections, RegistryKey } from './types'

export type { AnyRef, AnyToken, FileToken, Ref } from './types'

export function ref<C extends RegistryCollectionSlug>(collection: C, key: RegistryCollections[C] & string): Ref<C> {
  return { __seedRef: 'doc', collection, key: key as RegistryKey<C> } //TODO: replace `as` cast with proper typing
}

export function file(name: string, options: Record<string, unknown> = {}): FileToken {
  return { __seedRef: 'file', name, options }
}

export function isRef(value: unknown): value is Ref {
  //TODO: replace `as` cast with proper typing
  return typeof value === 'object' && value !== null && (value as { __seedRef?: unknown }).__seedRef === 'doc'
}

export function isFileToken(value: unknown): value is FileToken {
  //TODO: replace `as` cast with proper typing
  return typeof value === 'object' && value !== null && (value as { __seedRef?: unknown }).__seedRef === 'file'
}

export function isAnyToken(value: unknown): value is AnyToken {
  return isRef(value) || isFileToken(value)
}
