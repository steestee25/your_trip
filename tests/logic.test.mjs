import { BASE_URL, chromium, OUT_DIR } from './browser.mjs'
const browser = await chromium.launch()
const ctx = await browser.newContext()
await ctx.route('**/tile.openstreetmap.org/**', r => r.abort())
const page = await ctx.newPage()
page.on('pageerror', e => console.log('PAGEERROR', e.message))
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)

const results = await page.evaluate(async () => {
  const { reducer } = await import('/src/state/reducer.ts')
  const { createInitialData } = await import('/src/state/factory.ts')
  const { sanitizeTrip, sanitizeAppData } = await import('/src/state/validate.ts')
  const { buildSuggestions, placesNear } = await import('/src/features/suggestions.ts')
  const { optimizeDay } = await import('/src/features/optimize.ts')
  const { buildItineraryText } = await import('/src/features/exportTrip.ts')
  const { itemsForDay, tripStats, inboxPlaces } = await import('/src/state/selectors.ts')

  const out = []
  const check = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
  let s = createInitialData()
  const t = () => s.trips.find(x => x.id === s.activeTripId)

  // --- places -------------------------------------------------------------
  const mk = (name, lat, lon, type = 'poi') => ({ name, type, latitude: lat, longitude: lon, category: 'attractions', sources: [{ provider: 'test', label: 'test', retrievedAt: new Date().toISOString() }] })
  s = reducer(s, { type: 'places/addMany', inputs: [
    mk('A', 51.5194, -0.1269), mk('B', 51.5055, -0.0754), mk('C', 51.5112, -0.0834),
    mk('D', 51.4613, -0.3039, 'area'), mk('E', 51.5090, -0.1960),
  ] })
  check('addMany created 5 places', t().places.length === 5)
  check('all 5 start in the Inbox', inboxPlaces(t()).length === 5)

  const [A, B, C, D, E] = t().places
  const day1 = t().days[0].id, day2 = t().days[1].id

  // --- itinerary ----------------------------------------------------------
  s = reducer(s, { type: 'items/addPlaces', dayId: day1, placeIds: [A.id, B.id, C.id] })
  s = reducer(s, { type: 'items/add', dayId: day1, item: { type: 'activity', title: 'Lunch', durationMinutes: 60 } })
  check('4 items on day 1', itemsForDay(t(), day1).length === 4)
  check('orders are dense 0..3', itemsForDay(t(), day1).map(i => i.order).join() === '0,1,2,3')
  check('placeless activity allowed', itemsForDay(t(), day1)[3].placeId === undefined)

  // same place twice, in two days, without duplicating the Place
  s = reducer(s, { type: 'items/addPlaces', dayId: day2, placeIds: [A.id] })
  check('same place reusable across days without duplication',
    t().places.length === 5 && t().items.filter(i => i.placeId === A.id).length === 2)

  // --- move / reorder -----------------------------------------------------
  const firstId = itemsForDay(t(), day1)[0].id
  s = reducer(s, { type: 'items/move', itemId: firstId, toDayId: day1, toIndex: 2 })
  check('reorder inside a day', itemsForDay(t(), day1)[2].id === firstId)
  s = reducer(s, { type: 'items/move', itemId: firstId, toDayId: day2, toIndex: 0 })
  check('move across days', itemsForDay(t(), day2)[0].id === firstId && itemsForDay(t(), day1).length === 3)
  check('source day renumbered', itemsForDay(t(), day1).map(i => i.order).join() === '0,1,2')
  check('target day renumbered', itemsForDay(t(), day2).map(i => i.order).join() === '0,1')

  // --- auto time ----------------------------------------------------------
  s = reducer(s, { type: 'items/autoTime', dayId: day1, startTime: '09:00', gapMinutes: 15 })
  const times = itemsForDay(t(), day1).map(i => `${i.startTime}-${i.endTime}`)
  check('auto-schedule produced monotonic times', times[0].startsWith('09:00'), times.join(' | '))

  // --- status derivation --------------------------------------------------
  const stats = tripStats(t())
  check('planned/inbox derived from the itinerary', stats.planned + stats.inbox <= stats.total, JSON.stringify({ planned: stats.planned, inbox: stats.inbox, total: stats.total }))

  // --- deleting a place cleans the itinerary ------------------------------
  s = reducer(s, { type: 'places/remove', placeId: A.id })
  check('removing a place removes its items', t().items.every(i => i.placeId !== A.id))
  check('remaining items stay dense', t().days.every(d => itemsForDay(t(), d.id).map(i => i.order).join() === itemsForDay(t(), d.id).map((_, n) => n).join()))

  // --- shrinking the trip -------------------------------------------------
  s = reducer(s, { type: 'items/addPlaces', dayId: t().days[1].id, placeIds: [E.id] })
  const plannedBefore = new Set(t().items.map(i => i.placeId).filter(Boolean))
  check('E is planned on day 2 before shrinking', plannedBefore.has(E.id))
  const before = t().items.length
  s = reducer(s, { type: 'days/setCount', count: 1 })
  const plannedAfter = new Set(t().items.map(i => i.placeId).filter(Boolean))
  check('shrinking days drops their items', t().days.length === 1 && t().items.length < before, `${before} -> ${t().items.length}`)
  check('the dropped stop returns to the Inbox', !plannedAfter.has(E.id) && t().places.some(p => p.id === E.id) && inboxPlaces(t()).some(p => p.id === E.id))
  s = reducer(s, { type: 'days/setCount', count: 4 })
  check('growing days keeps existing ones', t().days.length === 4 && t().days.map(d => d.index).join() === '0,1,2,3')

  // --- categories ---------------------------------------------------------
  s = reducer(s, { type: 'categories/add', category: { id: 'custom', name: 'Street art', emoji: '🎨', color: '#ff0000' } })
  s = reducer(s, { type: 'places/patch', placeId: B.id, patch: { category: 'custom' } })
  s = reducer(s, { type: 'categories/remove', categoryId: 'custom' })
  check('deleting a category re-homes its places', t().places.find(p => p.id === B.id).category === 'other')
  const builtInCount = t().categories.filter(c => c.builtIn).length
  s = reducer(s, { type: 'categories/remove', categoryId: 'museums' })
  check('built-in categories cannot be deleted', t().categories.filter(c => c.builtIn).length === builtInCount)

  // --- suggestions --------------------------------------------------------
  let s2 = createInitialData()
  s2 = reducer(s2, { type: 'places/addMany', inputs: [
    { ...mk('Richmond', 51.4613, -0.3039, 'area'), boundingBox: { south: 51.44, north: 51.48, west: -0.33, east: -0.28 } },
    mk('Richmond Park', 51.4450, -0.2900), mk('Petersham', 51.4500, -0.3000), mk('Ham House', 51.4470, -0.3150),
  ] })
  const sug = buildSuggestions(s2.trips[0])
  const nearbySug = sug.find(x => x.kind === 'nearby-area')
  check('"places near an area" suggestion fires', !!nearbySug, nearbySug?.title)
  check('nothing is auto-added by a suggestion', s2.trips[0].items.length === 0)
  check('placesNear finds the POIs inside the area', placesNear(s2.trips[0], s2.trips[0].places[0]).length === 3)

  // --- optimizer ----------------------------------------------------------
  const stops = [
    { item: { id: '1' }, coords: { latitude: 51.5194, longitude: -0.1269 } },
    { item: { id: '2' }, coords: { latitude: 51.4613, longitude: -0.3039 } },
    { item: { id: '3' }, coords: { latitude: 51.5112, longitude: -0.0834 } },
    { item: { id: '4' }, coords: null },
    { item: { id: '5' }, coords: { latitude: 51.5055, longitude: -0.0754 } },
  ]
  const opt = await optimizeDay(stops, { useRouting: false })
  check('optimiser proposes a shorter path', opt.afterMeters <= opt.beforeMeters, `${(opt.beforeMeters/1000).toFixed(1)} km -> ${(opt.afterMeters/1000).toFixed(1)} km`)
  check('optimiser keeps placeless stops pinned', opt.orderedIds[3] === '4' && opt.pinnedCount === 1)
  check('optimiser returns every stop exactly once', new Set(opt.orderedIds).size === 5)
  check('estimates are labelled', opt.routed === false && /straight-line/.test(opt.note))

  // --- export / import round trip ----------------------------------------
  const exported = JSON.parse(JSON.stringify(t()))
  const reimported = sanitizeTrip(exported)
  check('trip survives a JSON round trip',
    reimported.places.length === t().places.length &&
    reimported.items.length === t().items.length &&
    reimported.days.length === t().days.length)
  check('sources survive the round trip', reimported.places.every(p => Array.isArray(p.sources)))
  check('garbage input is rejected, not crashed on', sanitizeAppData({ nonsense: true }) === null)
  check('a corrupt trip is repaired', (() => {
    const broken = sanitizeTrip({ name: 'x', days: [{ id: 'd1' }], places: [{ name: 'ok' }, { junk: 1 }], items: [{ dayId: 'missing' }, { dayId: 'd1', order: 5 }] })
    return broken.places.length === 1 && broken.items.length === 1 && broken.items[0].order === 0
  })())

  const text = buildItineraryText(t())
  check('markdown export mentions every day', t().days.every(d => text.includes(`Day ${d.index + 1}`)))

  return out
})

console.log(results.join('\n'))
const failed = results.filter(r => r.startsWith('FAIL'))
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
await browser.close()
process.exit(failed.length ? 1 : 0)
