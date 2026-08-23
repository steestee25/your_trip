import { useEffect, useState } from 'react'

/**
 * Subscribes to a media query. Used to mount *either* the desktop panels or the
 * mobile sheet — never both, which would create duplicate drop-target ids.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return
    const list = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Matches Tailwind's `lg` breakpoint, where the three-column layout appears. */
export const DESKTOP_QUERY = '(min-width: 64rem)'
