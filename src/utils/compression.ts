export type CompressionTask = { action: 'encode' | 'decode'; value: string; password?: string }
export type CompressionResult = { ok: true; value: string } | { ok: false; error: string }

export function runCompressionTask(task: CompressionTask, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('작업을 취소했습니다.', 'AbortError'))
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
    const abort = () => finish(new DOMException('작업을 취소했습니다.', 'AbortError'))
    worker.onmessage = ({ data }: MessageEvent<CompressionResult>) => {
      if (data.ok && typeof data.value === 'string') finish(undefined, data.value)
      else finish(new Error('error' in data ? data.error : '공유 링크를 처리하지 못했습니다.'))
    }
    worker.onerror = () => finish(new Error('공유 링크를 처리하지 못했습니다. 다시 시도해주세요.'))
    signal?.addEventListener('abort', abort, { once: true })
    timer = setTimeout(() => finish(new Error('처리 시간이 초과되었습니다. 다시 시도해주세요.')), 30_000)
    worker.postMessage(task)
  })
}
