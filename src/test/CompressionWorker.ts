import { createRequire } from 'node:module'
import type { CompressionTask } from '../utils/compression'
import { decryptMarkdown, encryptMarkdown } from '../utils/encryption'
import { decodeMarkdown, encodeMarkdown } from '../utils/urlCodec'

const brotli = createRequire(import.meta.url)('brotli-wasm')

// jsdom has no browser Workers; only the message transport is replaced.
export class CompressionWorker {
  static pending: CompressionWorker[] = []
  onmessage: ((event: { data: { ok: boolean; value?: string; error?: string } }) => void) | null = null
  onerror: (() => void) | null = null
  task!: CompressionTask
  terminated = false

  postMessage(task: CompressionWorker['task']) {
    this.task = task
    CompressionWorker.pending.push(this)
  }

  async complete() {
    if (this.terminated) return
    try {
      const value =
        this.task.action === 'encode'
          ? this.task.password
            ? await encryptMarkdown(this.task.value, brotli, this.task.password)
            : encodeMarkdown(this.task.value, brotli)
          : decodeURIComponent(this.task.value).startsWith('e1.')
            ? await decryptMarkdown(decodeURIComponent(this.task.value), brotli, this.task.password ?? '')
            : decodeMarkdown(this.task.value, brotli)
      if (this.terminated) return
      this.onmessage?.({ data: { ok: true, value } })
    } catch (error) {
      this.onmessage?.({ data: { ok: false, error: (error as Error).message } })
    }
  }

  terminate() {
    this.terminated = true
  }

  static async finishAll() {
    const pending = CompressionWorker.pending
    CompressionWorker.pending = []
    await Promise.all(pending.map((worker) => worker.complete()))
  }
}
