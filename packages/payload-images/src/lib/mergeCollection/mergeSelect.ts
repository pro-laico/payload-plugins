import type { CollectionConfig } from 'payload'

export const mergeSelect = (
  base: CollectionConfig['defaultPopulate'],
  override: CollectionConfig['defaultPopulate'],
): CollectionConfig['defaultPopulate'] =>
  base || override
    ? ({
        ...(base as Record<string, unknown>), //TODO: replace `as` cast with proper typing
        ...(override as Record<string, unknown> | undefined), //TODO: replace `as` cast with proper typing
      } as CollectionConfig['defaultPopulate']) //TODO: replace `as` cast with proper typing
    : undefined
