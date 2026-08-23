# Universal Trip Planner

A visual planner for trips in any city or country, including multi-destination trips.
Collect places → see them on the map → organise them into days → optimise the route.

Everything runs in the browser. **No backend, no account, no API keys, no paid services, no tracking.**
Your trip is stored locally (IndexedDB, with a localStorage backup) and can be exported as JSON,
Markdown or a printable page.

---

## 1. Project structure

```
universal-trip-planner/
├── index.html
├── vite.config.ts                 Vite + React + Tailwind v4
├── tsconfig*.json                 strict TS, project references
├── public/favicon.svg
├── tests/
│   ├── browser.mjs                Playwright resolver + shared fixtures
│   ├── logic.test.mjs             32 checks on the reducer, optimiser, validation, export
│   └── e2e.test.mjs               full browser flow with mocked provider responses
└── src/
    ├── main.tsx                   entry: StoreProvider → UiProvider → App
    ├── App.tsx                    layout, DndContext, drag handlers, modal routing
    ├── index.css                  Tailwind theme, Leaflet overrides, marker styles
    ├── types.ts                   Place, ItineraryItem, Day, Trip, Category, AppData …
    │
    ├── providers/                 ← swappable data sources (the abstraction layer)
    │   ├── types.ts               GeocodingProvider · EnrichmentProvider · RoutingProvider · DiscoveryProvider
    │   ├── nominatim.ts           GeocodingProvider   (OpenStreetMap / Nominatim)
    │   ├── wikidata.ts            EnrichmentProvider  (Wikidata + Wikipedia)
    │   ├── osrm.ts                RoutingProvider     (OSRM demo server + straight-line fallback)
    │   ├── overpass.ts            DiscoveryProvider   (Overpass API)
    │   ├── osmClassify.ts         OSM class/type → PlaceType + category
    │   └── index.ts               single binding point — swap a provider here
    │
    ├── state/
    │   ├── store.tsx              React context + reducer, debounced persistence, undo
    │   ├── reducer.ts             every mutation, one pure function
    │   ├── persistence.ts         IndexedDB with localStorage fallback
    │   ├── validate.ts            defensive sanitisation of stored / imported data
    │   ├── selectors.ts           derived data (inbox, stats, filters, day items)
    │   ├── factory.ts             trip / place construction
    │   ├── categories.ts          the 14 seed categories
    │   └── ui.tsx                 view state (selection, filters, modals, toasts)
    │
    ├── features/
    │   ├── optimize.ts            nearest-neighbour + 2-opt, before/after comparison
    │   ├── suggestions.ts         local, rule-based smart suggestions
    │   ├── importList.ts          bulk paste → search → ✓ / ⚠️ / ✕ resolution
    │   ├── enrich.ts              non-destructive metadata top-up
    │   ├── placeFromResult.ts     GeocodeResult → Place, activity/transport presets
    │   └── exportTrip.ts          JSON, Markdown and printable HTML export
    │
    └── components/
        ├── TopBar.tsx  MobileSheet.tsx
        ├── sidebar/    SearchPanel · Dashboard · Suggestions · Filters · PlaceList · PlaceCard
        ├── map/        MapView · icons · useDayRoute
        ├── itinerary/  ItineraryPanel · DayColumn · ItemRow · AddToDayMenu
        ├── place/      PlaceDetail · NearbyDiscovery
        ├── modals/     ImportList · Optimize · TripSettings · Categories · Trips · About
        └── ui/         Button · Modal · Field · Chip · Spinner · Toasts
```

## 2. Running it

Requires Node 20+.

```bash
npm install
npm run dev            # http://localhost:5173
```

```bash
npm run build          # type-check + production build into dist/
npm run preview        # serve the production build
npm run typecheck      # tsc only
```

Tests (Playwright is **not** a project dependency — install it only if you want to run them):

```bash
npm i -D playwright && npx playwright install chromium
npm run dev            # in one terminal
npm test               # in another: 32 logic checks + the full browser flow
```

`tests/e2e.test.mjs` mocks the provider responses, so the suite is deterministic and makes
no real calls to any public service.

## 3. Free services used

| Purpose | Service | Licence | Key needed |
|---|---|---|---|
| Map tiles | [tile.openstreetmap.org](https://www.openstreetmap.org/copyright) | ODbL | no |
| Geocoding / search | [Nominatim](https://nominatim.org/) | ODbL | no |
| Descriptions, websites, photos | [Wikidata](https://www.wikidata.org/) (CC0) + [Wikipedia REST](https://en.wikipedia.org/api/rest_v1/) (CC BY-SA) | CC0 / CC BY-SA | no |
| Discovering nearby places | [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) | ODbL | no |
| Road distances / times | [OSRM demo server](https://project-osrm.org/) | ODbL | no |

All four are optional except Nominatim: Wikidata/Wikipedia, Overpass and OSRM each have a switch in
**Trip settings → Online services**. With all three off, the app works fully offline apart from map
tiles and search.

Each provider sits behind an interface in `src/providers/types.ts`. To replace one — say Nominatim
with Photon, or OSRM with a self-hosted instance — implement the interface and change one line in
`src/providers/index.ts`.

## 4. Rate limits and how they are respected

| Service | Documented limit | What the app does |
|---|---|---|
| Nominatim | max **1 req/s**, no heavy bulk, caching required | a serialised queue with a **1.2 s** minimum interval; results cached **30 days** (localStorage); **no autocomplete** — search runs only when you press Enter or the button; list import walks the same queue, one line at a time |
| Overpass | shared community resource, fair use | **3 s** minimum interval, `[timeout:25]`, results capped at 120 elements, cached **7 days**, and **only ever runs when you press "Find nearby places"** |
| OSRM demo | "not for heavy use" | **1.1 s** minimum interval, cached **7 days**, max 25 waypoints per request, and a **5-minute cool-down** after any failure before it is tried again |
| Wikidata / Wikipedia | be reasonable | **0.6 s** minimum interval, cached **30 days**, at most two requests per place, run once after a place is saved |

Identical requests in flight are de-duplicated and share one promise. The cache holds 500 entries and
evicts the oldest half if the browser runs out of quota.

## 5. Design decisions and trade-offs

**Place vs ItineraryItem are separate.** A `Place` is saved once; an `ItineraryItem` is one appearance
of it in a day. So the same place can sit in Day 2 and Day 5 without ever being duplicated, and
`placeId` is optional — `Lunch`, `Free time` and `Travel` are real itinerary rows with no location.

**Status is derived, not stored.** `Inbox` / `Planned` is computed from the itinerary, so the two can
never disagree; only `visited` is stored, because only you know that.

**Areas and cities are first-class stops.** `Richmond` or `Dover` can be a day's stop on its own, with
a duration, a marker and — when OpenStreetMap publishes one — its real polygon. **No boundary is ever
invented:** if there is no published geometry, the app shows a representative point and says so.
Polygons above 4 000 coordinates are dropped rather than freezing the map.

**Nothing is invented, and nothing is auto-applied.** Missing fields stay empty. Every `Place` keeps
its `sources[]` (provider, URL, licence, timestamp), shown in the detail panel and preserved through
export/import. Suggestions and the optimiser only ever *propose* — the itinerary changes when you
click Apply, never before.

**Honest distances.** When OSRM answers, the app says "by road". When it does not, it falls back to
straight-line estimates and labels them as estimates everywhere they appear. Travel times are never
fabricated: the straight-line fallback shows distance only in the optimiser, and the OSRM demo server
serves a driving profile, so its durations are labelled "driving".

**Applying an optimised order re-flows the clock.** Reordering stops would otherwise leave each one
holding its old time, producing a nonsense schedule. The Apply dialog offers a re-flow that keeps
every duration and restacks the day from its first start time — opt-out, and shown before you commit.

**The optimiser is deliberately simple** — nearest neighbour seeded, then 2-opt, on great-circle
distances, with the first stop pinned as the starting point. Rows without coordinates keep their slot
so the day's rhythm survives. If the proposed order is not actually shorter, the app keeps yours.

**Robustness.** Every provider call is wrapped with a timeout, bounded retries (only on 5xx / 429 /
network errors) and human-readable messages. A failed lookup never loses a place: it is saved first
and enriched afterwards. Stored and imported data goes through `validate.ts`, which repairs dangling
day/place references, re-numbers orders and re-seeds missing categories rather than crashing.

**Known trade-offs.**
- Markers are plain Leaflet markers, not clustered. Above roughly a thousand places on one screen the
  map would want clustering; that is a dependency this build does not take.
- Times are naive `HH:MM` strings with no timezone maths — correct for a single-destination day, and
  the honest limit for a multi-country trip crossing timezones.
- Undo covers the last 40 actions in memory and is not persisted across reloads.
- The Wikipedia fallback for untagged places accepts an article only on an exact normalised
  title match within 400 m. It misses some real matches; that is the deliberate direction to err in.
- The public OSRM demo server has no walking profile, so "by road" means driving.

## 6. Attribution

Map data and geocoding © OpenStreetMap contributors, ODbL.
Descriptions from Wikipedia (CC BY-SA) and Wikidata (CC0), attributed per place in the detail panel
and in every export.
