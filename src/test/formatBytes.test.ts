import { describe, expect, it } from 'vitest'
import { formatBytes } from '../utils/formatBytes'

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1000, '1 KB'],
    [1530, '1.53 KB'],
    [999999, '1 MB'],
    [1000000, '1 MB'],
    [1234567, '1.23 MB'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})
