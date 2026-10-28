import { getLocale, type Locale, translate as t } from '../i18n/core'
export type CompressionTask = { action: 'encode' | 'decode'; value: string; password?: string; locale?: Locale }
export type CompressionResult = { ok: true; value: string } | { ok: false; error: string }

export function runCompressionTask(task: CompressionTask, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException(t('error.cancelled'), 'AbortError'))
      return
    }
    const worker = new Worker(new URL('../workers/compression.worker.ts', import.meta.url), { type: 'module' })
    let timer: ReturnType<typeof setTimeout>
    const finish = (error?: Error, value?: string) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      if (error) reject(error)
      else resolve(value!)
    }
    const abort = () => finish(new DOMException(t('error.cancelled'), 'AbortError'))
    worker.onmessage = ({ data }: MessageEvent<CompressionResult>) => {
      if (data.ok && typeof data.value === 'string') finish(undefined, data.value)
      else finish(new Error('error' in data ? data.error : t('error.processLink')))
    }
    worker.onerror = () => finish(new Error(t('error.retryLink')))
    signal?.addEventListener('abort', abort, { once: true })
    timer = setTimeout(() => finish(new Error(t('error.timeout'))), 30_000)
    worker.postMessage({ ...task, locale: getLocale() })
  })
}
