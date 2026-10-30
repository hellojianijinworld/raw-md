// @vitest-environment node
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import LZString from 'lz-string'
import { afterEach, expect, it, vi } from 'vitest'
import { decryptMarkdown } from '../utils/encryption'
import { decodeLegacyLz } from '../utils/legacyLz'
import { decodeMarkdown } from '../utils/urlCodec'

vi.stubGlobal('crypto', webcrypto)
afterEach(() => vi.restoreAllMocks())

// Generated with lz-string and Node AES-GCM independently of the bounded decoder.
const oversized = JSON.parse(readFileSync(new URL('./fixtures/legacy-overlimit.json', import.meta.url), 'utf8'))

it('reads legacy URI content without entering the unbounded dependency decoder', () => {
  vi.spyOn(LZString, 'decompressFromEncodedURIComponent').mockImplementation(() => {
    throw new Error('Unbounded decoder is unavailable')
  })
  expect(decodeMarkdown('BYUwNmD2Q')).toBe('hello')
})

it('reads encrypted legacy payloads without entering either unbounded dependency decoder', async () => {
  vi.spyOn(LZString, 'decompressFromUint8Array').mockImplementation(() => {
    throw new Error('Unbounded decoder is unavailable')
  })
  vi.spyOn(LZString, 'decompressFromEncodedURIComponent').mockImplementation(() => {
    throw new Error('Unbounded decoder is unavailable')
  })
  const fixture = 'e1.AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaG5-qouGbwXzgcgTwpBZwFDipFBslqPDljNw'
  expect(await decryptMarkdown(fixture, {} as never, 'compatibility password 🔑')).toBe('hello')
}, 15_000)

it.each([
  '',
  'hello',
  '\ufeff A\r\n\0😀 한글\ud800',
  'a'.repeat(65536),
])('restores both legacy representations with exact UTF-16 content (%#)', (source) => {
  for (const input of [LZString.compressToEncodedURIComponent(source), LZString.compressToUint8Array(source)]) {
    expect(decodeLegacyLz(input, source.length)).toBe(source)
    if (source.length) expect(() => decodeLegacyLz(input, source.length - 1)).toThrow()
  }
})

it('rejects compact expansion bombs at the character budget', () => {
  expect(oversized.sourceBytes).toBe(4 * 1024 * 1024 + 1)
  expect(() => decodeMarkdown(oversized.fragment)).toThrow()
  expect(() => decodeLegacyLz(oversized.fragment, 8)).toThrow()
  expect(() => decodeLegacyLz(LZString.compressToUint8Array('a'.repeat(100)), 8)).toThrow()
})

it('rejects an authenticated encrypted legacy expansion bomb before canonical recompression', async () => {
  await expect(decryptMarkdown(oversized.encryptedFragment, {} as never, oversized.password)).rejects.toThrow()
}, 15_000)

it('rejects malformed dictionary codes, truncated streams, and odd binary input', () => {
  for (const input of ['!', 'B', new Uint8Array([0])]) {
    expect(() => decodeLegacyLz(input)).toThrow()
  }
})
