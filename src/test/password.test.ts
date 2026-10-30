import { webcrypto } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { generateSharePassword } from '../utils/password'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('preserves all 128 random bits in a 22-character password without modulo bias', () => {
  vi.stubGlobal('crypto', webcrypto)
  const random = vi.spyOn(webcrypto, 'getRandomValues').mockImplementation((bytes) => {
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes?.byteLength).toBe(16)
    new Uint8Array(bytes!.buffer).set(Uint8Array.from({ length: 16 }, (_, i) => i))
    return bytes
  })
  expect(generateSharePassword()).toBe('AAECAwQFBgcICQoLDA0ODw')
  expect(random).toHaveBeenCalledOnce()
})
