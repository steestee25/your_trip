export class HttpError extends Error {
  readonly status?: number
  readonly url?: string

  constructor(message: string, status?: number, url?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.url = url
  }
}

export interface FetchOptions {
  signal?: AbortSignal
  timeoutMs?: number
  headers?: Record<string, string>
  /** Retries on network errors / 5xx / 429 only. */
  retries?: number
}

/**
 * fetch + JSON with a timeout, bounded retries and human-readable errors.
 * Providers surface these errors; the UI never crashes on a failed request.
 */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 15000, retries = 1, headers, signal } = options
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const onAbort = () => controller.abort(signal?.reason)
    if (signal) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      signal.addEventListener('abort', onAbort, { once: true })
    }
    const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', ...headers },
        // No credentials, no cookies: these are anonymous public endpoints.
        credentials: 'omit',
        referrerPolicy: 'strict-origin-when-cross-origin',
      })
      if (!response.ok) {
        if (response.status === 429) {
          throw new HttpError('Rate limit reached. Please wait a moment and retry.', 429, url)
        }
        if (response.status >= 500) {
          throw new HttpError(`The service is temporarily unavailable (${response.status}).`, response.status, url)
        }
        if (response.status === 400) {
          throw new HttpError('The search service rejected that request. Try a simpler search term.', 400, url)
        }
        throw new HttpError(`Request failed with status ${response.status}.`, response.status, url)
      }
      return (await response.json()) as T
    } catch (error) {
      lastError = error
      if (signal?.aborted) throw error
      const status = error instanceof HttpError ? error.status : undefined
      const retryable = status === undefined || status === 429 || status >= 500
      if (!retryable || attempt === retries) break
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)))
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
  }

  if (lastError instanceof HttpError) throw lastError
  if (lastError instanceof DOMException && lastError.name === 'AbortError') throw lastError
  throw new HttpError(
    'Could not reach the service. Check your connection and try again.',
    undefined,
    url,
  )
}

export function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Request cancelled.'
  if (error instanceof HttpError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong.'
}
