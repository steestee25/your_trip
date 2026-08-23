import { cached, DAY_MS } from '../lib/cache'
import { fetchJson } from '../lib/http'
import { RateLimitedQueue } from '../lib/queue'
import { hashKey, normalizeName } from '../lib/text'
import type { Place, PlaceSource } from '../types'
import type { EnrichmentProvider, EnrichmentResult } from './types'

const CACHE_TTL = 30 * DAY_MS
const queue = new RateLimitedQueue(600, 'wikimedia')

/* ------------------------------------------------------------------ Wikidata */

interface WikidataValue {
  mainsnak?: {
    datavalue?: { value?: unknown; type?: string }
  }
  rank?: string
}

interface WikidataEntity {
  descriptions?: Record<string, { language: string; value: string }>
  labels?: Record<string, { language: string; value: string }>
  sitelinks?: Record<string, { site: string; title: string; url?: string }>
  claims?: Record<string, WikidataValue[]>
}

interface EntityDataResponse {
  entities: Record<string, WikidataEntity>
}

function firstStringClaim(entity: WikidataEntity, property: string): string | undefined {
  const claims = entity.claims?.[property]
  if (!claims?.length) return undefined
  for (const claim of claims) {
    if (claim.rank === 'deprecated') continue
    const value = claim.mainsnak?.datavalue?.value
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function commonsImageUrl(filename: string): string {
  // Special:FilePath resolves to the real file and honours the width parameter.
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=640`
}

async function fetchWikidataEntity(qid: string, signal?: AbortSignal): Promise<WikidataEntity | null> {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`
  const data = await cached(`wikidata:${qid}`, CACHE_TTL, () =>
    queue.add(() => fetchJson<EntityDataResponse>(url, { signal, timeoutMs: 15000 })),
  )
  return data?.entities?.[qid] ?? null
}

/* ----------------------------------------------------------------- Wikipedia */

interface WikipediaSummary {
  title?: string
  extract?: string
  description?: string
  content_urls?: { desktop?: { page?: string } }
  originalimage?: { source?: string }
  thumbnail?: { source?: string }
  wikibase_item?: string
  type?: string
  coordinates?: { lat: number; lon: number }
}

async function fetchWikipediaSummary(
  lang: string,
  title: string,
  signal?: AbortSignal,
): Promise<WikipediaSummary | null> {
  const url = `https://${encodeURIComponent(lang)}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, '_'),
  )}`
  try {
    return await cached(`wikipedia:${lang}:${hashKey(title)}`, CACHE_TTL, () =>
      queue.add(() => fetchJson<WikipediaSummary>(url, { signal, timeoutMs: 15000 })),
    )
  } catch {
    // A missing article is a 404, which is a normal outcome, not an error.
    return null
  }
}

interface GeoSearchResponse {
  query?: { geosearch?: Array<{ pageid: number; title: string; lat: number; lon: number; dist: number }> }
}

/**
 * Last-resort lookup for places with no wiki tags: search Wikipedia articles
 * within 400 m and accept one **only** if its title matches the place name.
 * Anything fuzzier would risk attaching the wrong description to a place.
 */
async function findArticleByProximity(place: Place, signal?: AbortSignal): Promise<string | null> {
  if (place.latitude === undefined || place.longitude === undefined) return null
  const params = new URLSearchParams({
    action: 'query',
    list: 'geosearch',
    gscoord: `${place.latitude}|${place.longitude}`,
    gsradius: '400',
    gslimit: '10',
    format: 'json',
    origin: '*',
  })
  const url = `https://en.wikipedia.org/w/api.php?${params.toString()}`
  try {
    const data = await cached(`wikigeo:${hashKey(url)}`, CACHE_TTL, () =>
      queue.add(() => fetchJson<GeoSearchResponse>(url, { signal, timeoutMs: 15000 })),
    )
    const target = normalizeName(place.name)
    const match = data.query?.geosearch?.find((entry) => normalizeName(entry.title) === target)
    return match ? match.title : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ Provider */

export class WikimediaEnrichmentProvider implements EnrichmentProvider {
  readonly id = 'wikimedia'
  readonly name = 'Wikidata & Wikipedia'
  readonly attribution = 'Descriptions from Wikipedia (CC BY-SA) and Wikidata (CC0)'

  canEnrich(place: Place): boolean {
    if (place.type === 'activity') return false
    return Boolean(place.wikidata || place.wikipedia || (place.latitude !== undefined && place.name))
  }

  async enrich(place: Place, signal?: AbortSignal): Promise<EnrichmentResult | null> {
    const sources: PlaceSource[] = []
    const retrievedAt = () => new Date().toISOString()
    const result: EnrichmentResult = { sources }

    let wikipediaTag = place.wikipedia
    let qid = place.wikidata

    // 1. Wikidata gives us the website, the image and a one-line description.
    if (qid) {
      try {
        const entity = await fetchWikidataEntity(qid, signal)
        if (entity) {
          const description = entity.descriptions?.en?.value
          if (description) result.description = description
          const website = firstStringClaim(entity, 'P856')
          if (website) result.website = website
          const image = firstStringClaim(entity, 'P18')
          if (image) result.imageUrl = commonsImageUrl(image)
          if (!wikipediaTag) {
            const sitelink = entity.sitelinks?.enwiki
            if (sitelink) wikipediaTag = `en:${sitelink.title}`
          }
          sources.push({
            provider: 'wikidata',
            label: 'Wikidata',
            url: `https://www.wikidata.org/wiki/${qid}`,
            ref: qid,
            license: 'CC0 1.0',
            retrievedAt: retrievedAt(),
          })
        }
      } catch {
        /* enrichment is optional: a failure must never lose the place */
      }
    }

    // 2. Wikipedia gives us a real paragraph of prose.
    if (!wikipediaTag && !qid) {
      const title = await findArticleByProximity(place, signal)
      if (title) wikipediaTag = `en:${title}`
    }

    if (wikipediaTag) {
      const [lang, ...rest] = wikipediaTag.includes(':') ? wikipediaTag.split(':') : ['en', wikipediaTag]
      const title = rest.join(':') || wikipediaTag
      const summary = await fetchWikipediaSummary(lang, title, signal)
      if (summary?.extract && summary.type !== 'disambiguation') {
        result.description = summary.extract
        result.wikipedia = `${lang}:${summary.title ?? title}`
        if (!result.imageUrl) {
          result.imageUrl = summary.originalimage?.source ?? summary.thumbnail?.source
        }
        if (!qid && summary.wikibase_item) {
          qid = summary.wikibase_item
        }
        sources.push({
          provider: 'wikipedia',
          label: `Wikipedia (${lang})`,
          url:
            summary.content_urls?.desktop?.page ??
            `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
          ref: `${lang}:${summary.title ?? title}`,
          license: 'CC BY-SA 4.0',
          retrievedAt: retrievedAt(),
        })
      }
    }

    if (qid && qid !== place.wikidata) result.wikidata = qid
    if (!result.description && !result.website && !result.imageUrl && !result.wikipedia) return null
    return result
  }
}

export const wikimedia = new WikimediaEnrichmentProvider()
