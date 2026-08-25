/**
 * Bundles the production build into one self-contained .html file that runs
 * straight from disk (file://) with no server and no install step.
 * Vite already inlines the CSS assets as data URIs, so only the CSS and JS
 * entry files need folding into the page.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DIST = 'dist'
const OUT = 'universal-trip-planner.html'

const assets = await readdir(join(DIST, 'assets'))
const cssFile = assets.find((f) => f.endsWith('.css'))
const jsFile = assets.find((f) => f.endsWith('.js'))
if (!cssFile || !jsFile) throw new Error('Run `npm run build` first.')

const css = await readFile(join(DIST, 'assets', cssFile), 'utf8')
const js = await readFile(join(DIST, 'assets', jsFile), 'utf8')
const favicon = await readFile('public/favicon.svg', 'utf8')

/** A literal `</script>` inside the bundle would close the tag early. */
const safe = (code) => code.replace(/<\/script>/gi, '<\\/script>')

let html = await readFile(join(DIST, 'index.html'), 'utf8')

/** Replaces exactly one match, and fails loudly rather than writing a broken file. */
function replaceOnce(source, pattern, replacement, what) {
  const matches = source.match(pattern)
  if (!matches || matches.length !== 1) {
    throw new Error(`Expected exactly one ${what} tag in dist/index.html, found ${matches?.length ?? 0}.`)
  }
  return source.replace(pattern, () => replacement)
}

html = replaceOnce(html, /<link rel="stylesheet"[^>]*>/g, `<style>${css}</style>`, 'stylesheet')
html = replaceOnce(html, /<link rel="icon"[^>]*>/g,
  `<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}" />`, 'icon')
// The script goes last: the bundle itself contains strings that look like tags.
html = replaceOnce(html, /<script type="module"[^>]*><\/script>/g,
  `<script type="module">${safe(js)}</script>`, 'module script')

await writeFile(OUT, html)
console.log(`${OUT} — ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB, fully self-contained`)
