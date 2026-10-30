/// <reference lib="webworker" />
import { setRuntimeLocale, translate as t } from '../i18n/core'
import type { CompressionResult, CompressionTask } from '../utils/compression'
import { decodeMarkdown, encodeMarkdown } from '../utils/urlCodec'

const context = self as unknown as DedicatedWorkerGlobalScope

context.onmessage = async ({ data }: MessageEvent<CompressionTask>) => {
  setRuntimeLocale(data.locale)
  let response: CompressionResult
  try {
    const hash = data.action === 'decode' ? decodeURIComponent(data.value) : ''
    const needsBrotli = data.action === 'encode' || /^[bje]1\./.test(hash)
    const brotli = needsBrotli ? await (await import('brotli-wasm')).default : undefined
    let value: string
    if (data.action === 'encode' && data.password) {
      const { encryptMarkdown } = await import('../utils/encryption')
      value = await encryptMarkdown(data.value, brotli!, data.password)
    } else if (data.action === 'decode' && hash.startsWith('e1.')) {
      const { decryptMarkdown } = await import('../utils/encryption')
      value = await decryptMarkdown(hash, brotli!, data.password ?? '')
    } else {
      value = data.action === 'encode' ? encodeMarkdown(data.value, brotli!) : decodeMarkdown(data.value, brotli)
    }
    response = { ok: true, value }
  } catch (error) {
    response = { ok: false, error: error instanceof Error ? error.message : t('error.processLink') }
  }
  context.postMessage(response)
}
