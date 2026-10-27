import type { BrotliWasmType } from 'brotli-wasm'
import LZString from 'lz-string'
import { packHangul, unpackHangul } from './hangulCodec'
import { decodeLegacyLz } from './legacyLz'

export type Brotli = Pick<BrotliWasmType, 'compress' | 'DecompressStream' | 'BrotliStreamResultCode'>
export type BrotliEncoder = Pick<Brotli, 'compress'>
export type BrotliDecoder = Brotli | { decompressBounded(input: Uint8Array, limit: number): Uint8Array }
const MAX_TEXT_BYTES = 4 * 1024 * 1024
export const MAX_HASH_LENGTH = MAX_TEXT_BYTES * 3
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const invalidLink = () => new Error('공유 링크가 잘렸거나 손상되었습니다. 원본 링크를 확인해주세요.')

function checksum(bytes: Uint8Array): number {
  let hash = 0x811c9dc5
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193)
  return hash >>> 0
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw invalidLink()
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  if (toBase64(bytes) !== text) throw invalidLink()
  return bytes
}

function frame(prefix: string, source: Uint8Array, compressed: Uint8Array): string {
  const bytes = new Uint8Array(8 + compressed.length)
  const header = new DataView(bytes.buffer)
  header.setUint32(0, source.length, true)
  header.setUint32(4, checksum(source), true)
  bytes.set(compressed, 8)
  return prefix + toBase64(bytes)
}

export function encodeMarkdown(markdown: string, brotli: BrotliEncoder): string {
  const source = encoder.encode(markdown)
  if (source.length > MAX_TEXT_BYTES) throw new Error('공유할 수 있는 문서 크기는 최대 4MB입니다.')
  let shortest = LZString.compressToEncodedURIComponent(markdown)
  // LZ-string preserves isolated UTF-16 surrogates that UTF-8 would replace.
  if (decoder.decode(source) !== markdown) return shortest
  for (const [prefix, bytes] of [
    ['b1.', source],
    ['j1.', packHangul(markdown)],
  ] as const) {
    const candidate = frame(prefix, source, brotli.compress(bytes, { quality: 11 }))
    if (candidate.length < shortest.length) shortest = candidate
  }
  return shortest
}

function decompressBounded(input: Uint8Array, limit: number, brotli: BrotliDecoder): Uint8Array {
  if ('decompressBounded' in brotli) return brotli.decompressBounded(input, limit)
  const stream = new brotli.DecompressStream()
  const chunks: Uint8Array[] = []
  let offset = 0
  let length = 0
  try {
    while (true) {
      const result = stream.decompress(input.subarray(offset), Math.min(65536, limit - length + 1))
      let code: number
      let consumed: number
      let output: Uint8Array
      try {
        code = result.code
        consumed = result.input_offset
        output = result.buf
      } finally {
        result.free()
      }
      offset += consumed
      length += output.length
      if (length > limit) throw invalidLink()
      chunks.push(output)
      if (code === brotli.BrotliStreamResultCode.ResultSuccess) {
        if (offset !== input.length) throw invalidLink()
        break
      }
      if (
        (code === brotli.BrotliStreamResultCode.NeedsMoreInput && offset === input.length) ||
        (!consumed && !output.length)
      )
        throw invalidLink()
    }
  } finally {
    stream.free()
  }
  const bytes = new Uint8Array(length)
  let position = 0
  for (const chunk of chunks) {
    bytes.set(chunk, position)
    position += chunk.length
  }
  return bytes
}

export function decodeMarkdown(raw: string, brotli?: BrotliDecoder): string {
  if (!raw) return ''
  if (raw.length > MAX_HASH_LENGTH) throw new Error('공유 링크가 너무 깁니다.')
  const hash = decodeURIComponent(raw)
  if (!hash.includes('.')) {
    const normalized = hash.replaceAll(' ', '+')
    const text = decodeLegacyLz(normalized, MAX_TEXT_BYTES)
    if (encoder.encode(text).length > MAX_TEXT_BYTES) throw new Error('문서 크기가 4MB를 초과합니다.')
    if (LZString.compressToEncodedURIComponent(text) !== normalized) throw invalidLink()
    return text
  }
  if (!/^[bj]1\./.test(hash)) throw new Error('지원하지 않는 공유 링크 형식입니다.')
  if (!brotli) throw new Error('압축기를 불러오지 못했습니다. 다시 시도해주세요.')
  const bytes = fromBase64(hash.slice(3))
  if (bytes.length < 9) throw invalidLink()
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const expectedLength = header.getUint32(0, true)
  if (expectedLength > MAX_TEXT_BYTES) throw new Error('문서 크기가 4MB를 초과합니다.')
  const packed = hash.startsWith('j1.')
  const output = decompressBounded(bytes.subarray(8), expectedLength * (packed ? 2 : 1), brotli)
  const text = packed ? unpackHangul(output) : decoder.decode(output)
  const source = encoder.encode(text)
  if (source.length !== expectedLength || checksum(source) !== header.getUint32(4, true)) throw invalidLink()
  return text
}
