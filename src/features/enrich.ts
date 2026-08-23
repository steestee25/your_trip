import { enrichmentProvider } from '../providers'
import type { Place, PlacePatch } from '../types'

/**
 * Best-effort metadata top-up. Returns the fields that were actually found —
 * nothing is guessed, and an unavailable service simply yields `null`.
 */
export async function enrichPlace(place: Place, signal?: AbortSignal): Promise<PlacePatch | null> {
  if (!enrichmentProvider.canEnrich(place)) return null
  try {
    const result = await enrichmentProvider.enrich(place, signal)
    if (!result) return null
    const patch: PlacePatch = {}
    // Never overwrite something the user (or the geocoder) already gave us.
    if (result.description && !place.description) patch.description = result.description
    if (result.website && !place.website) patch.website = result.website
    if (result.wikipedia && !place.wikipedia) patch.wikipedia = result.wikipedia
    if (result.wikidata && !place.wikidata) patch.wikidata = result.wikidata
    if (result.imageUrl && !place.imageUrl) patch.imageUrl = result.imageUrl
    if (Object.keys(patch).length === 0) return null
    patch.sources = [...(place.sources ?? []), ...result.sources]
    return patch
  } catch {
    return null
  }
}
