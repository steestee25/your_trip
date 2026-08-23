/**
 * Resolves Playwright from the project or from a global install, so the test
 * scripts work whether you ran `npm i -D playwright` or `npm i -g playwright`.
 * Playwright is not a project dependency: the app itself needs nothing extra.
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

async function load() {
  try {
    return await import('playwright')
  } catch {
    /* not installed locally */
  }
  try {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim()
    return await import(pathToFileURL(`${root}/playwright/index.mjs`).href)
  } catch {
    throw new Error(
      'Playwright is required for these tests. Run `npm i -D playwright && npx playwright install chromium`.',
    )
  }
}

export const { chromium } = await load()
export const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173/'
export const OUT_DIR = process.env.OUT_DIR ?? new URL('.', import.meta.url).pathname

/** 1×1 PNG used in place of real map tiles. */
export const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

export { require }
