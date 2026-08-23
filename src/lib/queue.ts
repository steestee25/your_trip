/**
 * Serialises calls to a remote service and guarantees a minimum interval
 * between requests. Every provider that hits a public endpoint goes through
 * one of these, so we can never accidentally burst.
 */
export class RateLimitedQueue {
  private queue: Array<() => void> = []
  private running = false
  private lastRun = 0

  private readonly minIntervalMs: number
  readonly label: string

  constructor(minIntervalMs: number, label: string) {
    this.minIntervalMs = minIntervalMs
    this.label = label
  }

  get pending(): number {
    return this.queue.length
  }

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        task().then(resolve, reject)
      })
      void this.drain()
    })
  }

  private async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      while (this.queue.length > 0) {
        const wait = this.minIntervalMs - (Date.now() - this.lastRun)
        if (wait > 0) await sleep(wait)
        const task = this.queue.shift()
        if (!task) break
        this.lastRun = Date.now()
        // The task settles its own promise; failures must not stall the queue.
        try {
          task()
        } catch {
          /* handled by the caller's promise */
        }
        // Give the task a tick to start before measuring the next interval.
        await sleep(0)
      }
    } finally {
      this.running = false
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
