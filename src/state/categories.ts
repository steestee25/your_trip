import type { Category } from '../types'

/** Seed categories. Users can rename, recolour, add and remove custom ones. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'attractions', name: 'Attractions', emoji: '🏛️', color: '#e11d48', builtIn: true },
  { id: 'museums', name: 'Museums', emoji: '🖼️', color: '#7c3aed', builtIn: true },
  { id: 'historic', name: 'Historic', emoji: '🏰', color: '#b45309', builtIn: true },
  { id: 'nature', name: 'Nature', emoji: '🌳', color: '#16a34a', builtIn: true },
  { id: 'restaurants', name: 'Restaurants', emoji: '🍽️', color: '#ea580c', builtIn: true },
  { id: 'cafes', name: 'Cafés', emoji: '☕', color: '#a16207', builtIn: true },
  { id: 'bars', name: 'Bars/Pubs', emoji: '🍺', color: '#ca8a04', builtIn: true },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', color: '#db2777', builtIn: true },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎭', color: '#9333ea', builtIn: true },
  { id: 'photography', name: 'Photography', emoji: '📸', color: '#0891b2', builtIn: true },
  { id: 'neighborhoods', name: 'Neighborhoods', emoji: '🏘️', color: '#0d9488', builtIn: true },
  { id: 'accommodation', name: 'Accommodation', emoji: '🏨', color: '#2563eb', builtIn: true },
  { id: 'transport', name: 'Transport', emoji: '🚉', color: '#475569', builtIn: true },
  { id: 'other', name: 'Other', emoji: '📍', color: '#64748b', builtIn: true },
]

export const FALLBACK_CATEGORY_ID = 'other'

export const CATEGORY_COLOR_CHOICES = [
  '#e11d48', '#ea580c', '#d97706', '#ca8a04', '#65a30d', '#16a34a',
  '#0d9488', '#0891b2', '#2563eb', '#4f46e5', '#7c3aed', '#9333ea',
  '#db2777', '#b45309', '#475569', '#64748b',
]

export const CATEGORY_EMOJI_CHOICES = [
  '📍', '🏛️', '🖼️', '🏰', '🌳', '🍽️', '☕', '🍺', '🛍️', '🎭', '📸', '🏘️',
  '🏨', '🚉', '⛪', '🏖️', '⛰️', '🎡', '🎨', '🍕', '🍷', '🚲', '⚽', '🎵',
  '🛶', '🧭', '🌅', '🎁', '💐', '🐾', '🚗', '✈️',
]

export function categoryById(categories: Category[], id: string | undefined): Category {
  return (
    (id ? categories.find((c) => c.id === id) : undefined) ??
    categories.find((c) => c.id === FALLBACK_CATEGORY_ID) ??
    categories[0]
  )
}
