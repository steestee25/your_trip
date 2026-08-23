import { BASE_URL, chromium, OUT_DIR } from './browser.mjs'

const PLACES = {
  'british museum': [{
    place_id: 1, osm_type: 'way', osm_id: 3859, lat: '51.51944', lon: '-0.12694',
    display_name: 'British Museum, Great Russell Street, Bloomsbury, London, WC1B 3DG, United Kingdom',
    name: 'British Museum', class: 'tourism', type: 'museum', importance: 0.79,
    boundingbox: ['51.5184', '51.5205', '-0.1290', '-0.1249'],
    address: { city: 'London', country: 'United Kingdom', country_code: 'gb', road: 'Great Russell Street' },
    extratags: { website: 'https://www.britishmuseum.org', wikidata: 'Q6373', wikipedia: 'en:British Museum' },
  }],
  'covent garden': [
    { place_id: 2, osm_type: 'node', osm_id: 26819236, lat: '51.51157', lon: '-0.12277',
      display_name: 'Covent Garden, London, WC2E 8RF, United Kingdom', name: 'Covent Garden',
      class: 'place', type: 'neighbourhood', importance: 0.55,
      boundingbox: ['51.5090', '51.5140', '-0.1270', '-0.1190'],
      address: { city: 'London', country: 'United Kingdom', country_code: 'gb' }, extratags: {} },
    { place_id: 3, osm_type: 'way', osm_id: 4076, lat: '51.51203', lon: '-0.12230',
      display_name: 'Covent Garden Market, London, United Kingdom', name: 'Covent Garden Market',
      class: 'amenity', type: 'marketplace', importance: 0.40,
      address: { city: 'London', country: 'United Kingdom', country_code: 'gb' }, extratags: {} },
  ],
  'tower bridge': [{
    place_id: 4, osm_type: 'way', osm_id: 665, lat: '51.50553', lon: '-0.07540',
    display_name: 'Tower Bridge, London, United Kingdom', name: 'Tower Bridge',
    class: 'man_made', type: 'bridge', importance: 0.72,
    address: { city: 'London', country: 'United Kingdom', country_code: 'gb' },
    extratags: { wikidata: 'Q83125' },
  }],
  'richmond': [{
    place_id: 5, osm_type: 'relation', osm_id: 90101, lat: '51.46130', lon: '-0.30390',
    display_name: 'Richmond, London, United Kingdom', name: 'Richmond',
    class: 'place', type: 'suburb', importance: 0.60,
    boundingbox: ['51.4400', '51.4800', '-0.3300', '-0.2800'],
    address: { city: 'London', country: 'United Kingdom', country_code: 'gb' }, extratags: {},
    geojson: { type: 'Polygon', coordinates: [[[-0.33,51.44],[-0.28,51.44],[-0.28,51.48],[-0.33,51.48],[-0.33,51.44]]] },
  }],
  'sky garden': [{
    place_id: 6, osm_type: 'way', osm_id: 777, lat: '51.51117', lon: '-0.08340',
    display_name: 'Sky Garden, 20 Fenchurch Street, London, United Kingdom', name: 'Sky Garden',
    class: 'tourism', type: 'attraction', importance: 0.5,
    address: { city: 'London', country: 'United Kingdom', country_code: 'gb' }, extratags: {},
  }],
  'notting hill': [{
    place_id: 7, osm_type: 'node', osm_id: 888, lat: '51.50900', lon: '-0.19600',
    display_name: 'Notting Hill, London, United Kingdom', name: 'Notting Hill',
    class: 'place', type: 'suburb', importance: 0.58,
    address: { city: 'London', country: 'United Kingdom', country_code: 'gb' }, extratags: {},
  }],
  'dishoom covent garden': [
    { place_id: 8, osm_type: 'node', osm_id: 999, lat: '51.51260', lon: '-0.12580',
      display_name: 'Dishoom, 12 Upper St Martin\'s Lane, London, United Kingdom', name: 'Dishoom',
      class: 'amenity', type: 'restaurant', importance: 0.31,
      address: { city: 'London', country: 'United Kingdom', country_code: 'gb' }, extratags: {} },
    { place_id: 9, osm_type: 'node', osm_id: 1000, lat: '51.52010', lon: '-0.07330',
      display_name: 'Dishoom Shoreditch, London, United Kingdom', name: 'Dishoom',
      class: 'amenity', type: 'restaurant', importance: 0.30,
      address: { city: 'London', country: 'United Kingdom', country_code: 'gb' }, extratags: {} },
  ],
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1500, height: 940 }, acceptDownloads: true })

let nominatimCalls = 0
await context.route('**/tile.openstreetmap.org/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }))
await context.route('**/nominatim.openstreetmap.org/search**', (route) => {
  nominatimCalls++
  const q = decodeURIComponent(new URL(route.request().url()).searchParams.get('q') || '').toLowerCase().trim()
  const body = PLACES[q] ?? (q.includes('unknownplace') ? [] : PLACES[Object.keys(PLACES).find((k) => q.includes(k)) ?? ''] ?? [])
  route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
})
await context.route('**/www.wikidata.org/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({
  entities: { Q6373: {
    descriptions: { en: { language: 'en', value: 'national museum in London' } },
    claims: { P856: [{ mainsnak: { datavalue: { value: 'https://www.britishmuseum.org', type: 'string' } } }] },
    sitelinks: { enwiki: { site: 'enwiki', title: 'British Museum' } },
  } },
}) }))
await context.route('**/*.wikipedia.org/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({
  title: 'British Museum',
  extract: 'The British Museum is a public museum dedicated to human history, art and culture located in the Bloomsbury area of London.',
  content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/British_Museum' } },
  wikibase_item: 'Q6373',
}) }))
// Routing is deliberately left failing to exercise the straight-line fallback.
await context.route('**/router.project-osrm.org/**', (r) => r.abort())

const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_')) errors.push(m.text()) })

const log = (...a) => console.log('•', ...a)

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

const search = page.getByPlaceholder('British Museum, Richmond, Dover…')

async function addPlace(query, index = 0) {
  await search.fill(query)
  await search.press('Enter')
  await page.waitForTimeout(700)
  const results = page.locator('ul li button', { hasText: '' })
  await page.locator('text=pick one').waitFor({ timeout: 5000 }).catch(() => {})
  const options = page.locator('li > button', { has: page.locator('div.truncate') })
  await options.nth(index).click()
  await page.waitForTimeout(600)
}

// ---- 1. search + disambiguation -------------------------------------------
await search.fill('Covent Garden')
await search.press('Enter')
await page.waitForTimeout(700)
const matchHeader = await page.getByText(/matches — pick one/).count()
log('disambiguation shown for ambiguous query:', matchHeader === 1)
await page.locator('li > button').first().click()
await page.waitForTimeout(500)

for (const q of ['British Museum', 'Tower Bridge', 'Sky Garden', 'Richmond']) {
  await search.fill(q)
  await search.press('Enter')
  await page.waitForTimeout(700)
  await page.locator('li > button').first().click()
  await page.waitForTimeout(500)
}

const inboxCount = await page.locator('[role="button"]', { hasText: 'British Museum' }).count()
log('British Museum card in sidebar:', inboxCount > 0)
log('nominatim requests so far:', nominatimCalls)

// ---- 2. enrichment ---------------------------------------------------------
await page.locator('[role="button"]').filter({ hasText: 'British Museum' }).first().click()
await page.waitForTimeout(900)
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('utp.state.v1')).trips[0].places.find(p => p.name === 'British Museum'))
log('enrichment ->', JSON.stringify({ description: stored?.description, website: stored?.website, wikipedia: stored?.wikipedia, sources: (stored?.sources ?? []).map(s => s.provider) }))
const sources = await page.getByText('Sources', { exact: true }).count()
log('sources section present:', sources === 1)
await page.getByRole('button', { name: 'Close' }).first().click()
await page.waitForTimeout(300)

// ---- 3. drag & drop --------------------------------------------------------
const card = page.getByTestId('place-card').filter({ hasText: 'Tower Bridge' }).first()
const day1 = page.getByTestId('day-0')
const dayBody = page.getByTestId('day-body-0')
async function dragTo(source, target) {
  const a = await source.boundingBox()
  const b = await target.boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 6 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 })
  await page.mouse.move(b.x + b.width / 2 + 2, b.y + b.height / 2 + 2, { steps: 5 })
  await page.waitForTimeout(250)
  await page.mouse.up()
  await page.waitForTimeout(700)
}
await dragTo(card, dayBody)
const inDay = await day1.getByText('Tower Bridge').count()
log('drag place -> Day 1 created an itinerary item:', inDay > 0)

// add two more via the day menu so we can optimise
for (const name of ['British Museum', 'Sky Garden', 'Richmond']) {
  await day1.getByTitle('Add to this day').click()
  await page.waitForTimeout(250)
  await page.getByPlaceholder('Find a saved place…').fill(name)
  await page.waitForTimeout(200)
  await page.locator('li > button').filter({ hasText: name }).first().click()
  await page.waitForTimeout(350)
}
log('day 1 stop count:', await day1.getByTestId('itinerary-item').count())

// ---- 4. activity without a place ------------------------------------------
await day1.getByTitle('Add to this day').click()
await page.waitForTimeout(250)
await page.getByRole('button', { name: 'activities' }).click()
await page.waitForTimeout(200)
await page.locator('button', { hasText: 'Lunch' }).first().click()
await page.waitForTimeout(400)
log('placeless activity added:', (await day1.getByText('Lunch').count()) > 0)

// ---- 5. auto-schedule ------------------------------------------------------
await day1.getByTitle('Add to this day').click()
await page.waitForTimeout(250)
await page.getByRole('button', { name: 'tools' }).click()
await page.waitForTimeout(200)
await page.getByText('Auto-schedule times').click()
await page.waitForTimeout(500)
log('times filled:', (await day1.getByText('09:00').count()) > 0)

// ---- 6. optimise (routing unavailable -> straight-line fallback) -----------
await day1.getByRole('button', { name: 'Optimise' }).click()
await page.waitForTimeout(2500)
const beforeAfter = await page.getByText('Before', { exact: true }).count()
const estimateNote = await page.getByText(/straight-line estimates, not road distances/).count()
log('optimise dialog shows before/after:', beforeAfter === 1)
log('fallback is labelled honestly:', estimateNote === 1)
await page.screenshot({ path: OUT_DIR + '/shot-optimize.png' })
const applyBtn = page.getByRole('button', { name: 'Apply new order' })
const enabled = await applyBtn.isEnabled()
log('apply button enabled (a shorter order was found):', enabled)
if (enabled) await applyBtn.click(); else await page.getByRole('button', { name: 'Cancel' }).click()
await page.waitForTimeout(600)

// ---- 7. day filter on the map ---------------------------------------------
await day1.locator('button').first().click()
await page.waitForTimeout(900)
const markers = await page.locator('.utp-pin').count()
const badges = await page.locator('.utp-badge').count()
log('map markers when a day is selected:', markers, 'numbered:', badges)
await page.screenshot({ path: OUT_DIR + '/shot-day.png' })

// ---- 8. area "nearby saved places" ----------------------------------------
await page.getByRole('button', { name: 'Show all' }).first().click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: /^All places/ }).click()
await page.waitForTimeout(400)
await page.getByTestId('place-card').filter({ hasText: 'Richmond' }).first().click()
await page.waitForTimeout(600)
const nearbyTab = page.getByRole('button', { name: /^Nearby/ })
log('area shows a Nearby tab:', (await nearbyTab.count()) === 1)

// ---- 9. persistence --------------------------------------------------------
const placesBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('utp.state.v1')).trips[0].places.length)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1600)
const placesAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('utp.state.v1')).trips[0].places.length)
const itemsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('utp.state.v1')).trips[0].items.length)
log('persisted across reload:', placesBefore === placesAfter, `${placesAfter} places, ${itemsAfter} items`)

// ---- 10. export ------------------------------------------------------------
await page.getByTitle('Trip settings').click()
await page.waitForTimeout(500)
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Export this trip (JSON)' }).click(),
])
const path = await download.path()
const json = JSON.parse(await (await import('node:fs/promises')).readFile(path, 'utf8'))
log('exported JSON:', download.suggestedFilename(), `${json.places.length} places, ${json.items.length} items, ${json.days.length} days`)
log('sources preserved in export:', (json.places.find((p) => p.name === 'British Museum')?.sources ?? []).map((s) => s.provider).join(','))
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// ---- 11. import list -------------------------------------------------------
await page.getByRole('button', { name: 'Import list' }).click()
await page.waitForTimeout(400)
await page.locator('textarea').first().fill('Notting Hill\nDishoom Covent Garden\nSomeUnknownPlaceXYZ')
await page.getByRole('button', { name: 'Search all' }).click()
await page.waitForTimeout(6000)
const summary = await page.getByText(/found · .* ambiguous · .* not found/).textContent()
log('import summary:', summary?.trim())
await page.screenshot({ path: OUT_DIR + '/shot-import.png' })
await page.getByRole('button', { name: /^Add \d+ place/ }).click()
await page.waitForTimeout(800)
log('places after import:', await page.evaluate(() => JSON.parse(localStorage.getItem('utp.state.v1')).trips[0].places.length))

await page.getByRole('button', { name: 'Show all' }).first().click()
await page.waitForTimeout(1200)
await page.screenshot({ path: OUT_DIR + '/shot-desktop.png' })

// ---- 12. mobile ------------------------------------------------------------
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(900)
await page.getByRole('button', { name: /Itinerary/ }).last().click()
await page.waitForTimeout(700)
await page.screenshot({ path: OUT_DIR + '/shot-mobile.png' })
log('mobile sheet visible:', (await page.getByText('Itinerary', { exact: true }).count()) > 0)

// ---- 13. back to desktop: only one layout is mounted, drag still works -----
await page.setViewportSize({ width: 1500, height: 940 })
await page.waitForTimeout(900)
log('single sidebar mounted:', (await page.getByPlaceholder('Filter saved places…').count()) === 1)
log('single day-0 droppable mounted:', (await page.getByTestId('day-0').count()) === 1)
await page.getByRole('button', { name: /^All places/ }).click()
await page.waitForTimeout(400)
await dragTo(page.getByTestId('place-card').filter({ hasText: 'Notting Hill' }).first(), page.getByTestId('day-body-1'))
log('drag still works after a resize round trip:', (await page.getByTestId('day-1').getByText('Notting Hill').count()) > 0)

console.log('\nERRORS:', errors.length ? JSON.stringify(errors, null, 1) : 'none')
await browser.close()
