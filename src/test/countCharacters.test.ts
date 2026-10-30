import { afterEach, describe, expect, it, vi } from 'vitest'
import { countCharacters } from '../utils/countCharacters'

afterEach(() => vi.unstubAllGlobals())

describe('countCharacters', () => {
  it('counts readable characters, including combining marks and joined emoji', () => {
    expect(countCharacters('한한 e\u0301 👨‍👩‍👧‍👦 🇰🇷')).toEqual({ count: 8, approximate: false })
  })

  it('counts spaces and line endings as characters, treating CRLF as one', () => {
    expect(countCharacters('A \r\nB\n')).toEqual({ count: 5, approximate: false })
    expect(countCharacters('')).toEqual({ count: 0, approximate: false })
  })

  it('counts large ASCII documents without allocating a list of characters', () => {
    expect(countCharacters('a'.repeat(4 * 1024 * 1024))).toEqual({ count: 4 * 1024 * 1024, approximate: false })
  })

  it('marks the Unicode code-point fallback as approximate when segmentation is unavailable', () => {
    vi.stubGlobal('Intl', {})
    expect(countCharacters('한👨‍👩‍👧‍👦')).toEqual({ count: 8, approximate: true })
    expect(countCharacters('A\r\nB')).toEqual({ count: 3, approximate: false })
  })
})
