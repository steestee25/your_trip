/** Short, collision-safe id. Uses crypto.randomUUID when available. */
export function uid(prefix = ''): string {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  return prefix ? `${prefix}_${raw}` : raw
}

export function nowIso(): string {
  return new Date().toISOString()
}
