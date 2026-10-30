import { webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import { afterEach, expect, it, vi } from 'vitest'
import { decryptMarkdown, encryptMarkdown } from '../utils/encryption'
import { decodeMarkdown, encodeMarkdown } from '../utils/urlCodec'

const brotli = createRequire(import.meta.url)('brotli-wasm')
const password = '긴 비밀번호 🔑 spaces stay'
vi.stubGlobal('crypto', webcrypto)
afterEach(() => vi.restoreAllMocks())

it('opens a fixed e1 fixture encrypted independently with node:crypto', async () => {
  const hash = 'e1.AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaG5-qouGbwXzgcgTwpBZwFDipFBslqPDljNw'
  expect(await decryptMarkdown(hash, brotli, 'compatibility password 🔑')).toBe('hello')
})

it.each([
  '',
  'hello',
  '\ufeff# 비밀 문서\n가나다\u0000😀\n'.repeat(80),
  'lone\ud800',
])('restores the exact source after compression and authenticated password encryption (%#)', async (source) => {
  const hash = await encryptMarkdown(source, brotli, password)
  expect(hash).toMatch(/^e1\.[\w-]+$/)
  expect(await decryptMarkdown(hash, brotli, password)).toBe(source)
  expect(() => decodeMarkdown(hash, brotli)).toThrow()
})

it('adds a fixed envelope to compressed binary instead of base64-encoding twice', async () => {
  const source = '# 한글 압축\n서버 저장 없이 긴 문서의 원문을 유지합니다.\n'.repeat(200)
  const plain = encodeMarkdown(source, brotli)
  expect(plain).toMatch(/^[bj]1\./)
  const first = await encryptMarkdown(source, brotli, password)
  const second = await encryptMarkdown(source, brotli, password)
  expect(first).not.toBe(second)
  expect(first.length - plain.length).toBeLessThanOrEqual(60)
  expect(await decryptMarkdown(first, brotli, password)).toBe(source)
})

it('rejects wrong passwords, modified salt/IV/ciphertext, and truncated envelopes', async () => {
  const hash = await encryptMarkdown('secret exact source', brotli, password)
  await expect(decryptMarkdown(hash, brotli, 'wrong password')).rejects.toThrow('비밀번호')
  for (const position of [3, 26, 50, hash.length - 4]) {
    const changed = hash.slice(0, position) + (hash[position] === 'A' ? 'B' : 'A') + hash.slice(position + 1)
    await expect(decryptMarkdown(changed, brotli, password)).rejects.toThrow()
  }
  await expect(decryptMarkdown(hash.slice(0, -12), brotli, password)).rejects.toThrow()
  await expect(decryptMarkdown('e1.AA', brotli, password)).rejects.toThrow()
  await expect(decryptMarkdown('e2.invalid', brotli, password)).rejects.toThrow()
  await expect(encryptMarkdown('secret', brotli, '')).rejects.toThrow()
}, 15_000) // This test intentionally performs several real 64 MiB Argon2 derivations.
