import { expect, it } from 'vitest'
import {
  averageGuessSeconds,
  minimumRandomLength,
  minimumRandomLengthForYears,
} from '../../scripts/security-report.mjs'

it('uses half the uniform candidate space for average classical exhaustive search', () => {
  expect(averageGuessSeconds(10n ** 12n, 1e12)).toBe(0.5)
  expect(averageGuessSeconds(2n ** 128n, 1e12)).toBeCloseTo(1.7014118346046923e26, -12)
  expect(() => averageGuessSeconds(100n, 0)).toThrow()
})

it('calculates length thresholds only under explicit uniform-random assumptions', () => {
  expect(minimumRandomLength(10, 128)).toBe(39)
  expect(minimumRandomLength(62, 128)).toBe(22)
  expect(minimumRandomLength(94, 128)).toBe(20)
  expect(minimumRandomLengthForYears(10, 1e12, 100)).toBe(22)
  expect(minimumRandomLengthForYears(26, 1e12, 100)).toBe(16)
  expect(minimumRandomLengthForYears(62, 1e12, 100)).toBe(13)
  expect(minimumRandomLengthForYears(94, 1e12, 100)).toBe(12)
})
