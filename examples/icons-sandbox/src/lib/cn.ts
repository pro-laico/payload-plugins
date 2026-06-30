import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind class lists, with later classes winning conflicts (clsx + tailwind-merge). */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
