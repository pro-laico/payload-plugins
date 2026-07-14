import { twMerge } from 'tailwind-merge'
import { type ClassValue, clsx } from 'clsx'

/** Merge Tailwind class lists, with later classes winning conflicts (clsx + tailwind-merge). */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
