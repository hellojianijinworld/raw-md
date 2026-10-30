import { createRequire } from 'node:module'
import LZString from 'lz-string'
import { expect, it } from 'vitest'
import { decodeMarkdown, encodeMarkdown } from '../utils/urlCodec'

const brotli = createRequire(import.meta.url)('brotli-wasm')
const document = Array.from(
  { length: 80 },
  (_, i) =>
    `## ${i + 1}. 문서 공유와 원문 복원\n한글과 다이어그램을 손실 없이 공유합니다. 공백과 줄바꿈도 유지합니다.\n`,
).join('\n')

it('opens existing LZ-string links and percent-encoded fragments', () => {
  expect(decodeMarkdown('BYUwNmD2Q')).toBe('hello')
  expect(decodeMarkdown(encodeURIComponent(LZString.compressToEncodedURIComponent('기존 링크 😀')))).toBe(
    '기존 링크 😀',
  )
  expect(decodeMarkdown('')).toBe('')
})

it('decodes a v1 frame produced independently with Node Brotli and the known FNV-1a hash of hello', () => {
  expect(decodeMarkdown('b1.BQAAAKssn08LAoBoZWxsbwM', brotli)).toBe('hello')
})

it('makes a versioned share fragment substantially shorter than the current format', () => {
  const hash = encodeMarkdown(document, brotli)
  expect(hash).toMatch(/^[bj]1\.[A-Za-z0-9_-]+$/)
  expect(hash.length).toBeLessThan(LZString.compressToEncodedURIComponent(document).length * 0.8)
  expect(decodeMarkdown(hash, brotli)).toBe(document)
})

it.each([
  '\ufeff첫 글자와 마지막 공백  \r\n\t가 각 값\n각\n😀 👨‍👩‍👧‍👦 é é \0 \u0080 \uffff',
  '',
  '짧은 글',
  '\ud800 고립 서로게이트 \udfff',
])('preserves every source character, including whitespace and unusual Unicode: %j', (text) => {
  const source = text + (text ? document : '')
  const hash = encodeMarkdown(source, brotli)
  expect(decodeMarkdown(hash, brotli)).toBe(source)
  expect(hash.length).toBeLessThanOrEqual(LZString.compressToEncodedURIComponent(source).length)
})

it('keeps the current format when its complete fragment is shorter', () => {
  const hash = encodeMarkdown('안녕', brotli)
  expect(hash).toBe(LZString.compressToEncodedURIComponent('안녕'))
})

it('rejects truncated or damaged modern fragments instead of opening an empty document', () => {
  const hash = encodeMarkdown(document, brotli)
  expect(() => decodeMarkdown(hash.slice(0, -8), brotli)).toThrow()
  const bytes = Buffer.from(hash.slice(3), 'base64url')
  bytes[4] ^= 1
  expect(() => decodeMarkdown(`${hash.slice(0, 3)}${bytes.toString('base64url')}`, brotli)).toThrow()
})

it('rejects unknown versions, malformed legacy data, and oversized declared output', () => {
  expect(() => decodeMarkdown('b2.AAAA', brotli)).toThrow()
  expect(() => decodeMarkdown('%not-a-link')).toThrow()
  expect(() => decodeMarkdown('Qgarbage')).toThrow()
  const hash = encodeMarkdown(document, brotli)
  const bytes = Buffer.from(hash.slice(3), 'base64url')
  bytes.writeUInt32LE(0xffffffff, 0)
  expect(() => decodeMarkdown(`${hash.slice(0, 3)}${bytes.toString('base64url')}`, brotli)).toThrow()
})

it('stops decompression when the payload grows beyond its declared length', () => {
  const hash = encodeMarkdown('a'.repeat(200_000), brotli)
  const bytes = Buffer.from(hash.slice(3), 'base64url')
  bytes.writeUInt32LE(1, 0)
  expect(() => decodeMarkdown(`${hash.slice(0, 3)}${bytes.toString('base64url')}`, brotli)).toThrow()
})
