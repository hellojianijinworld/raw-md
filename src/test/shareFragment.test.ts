import { expect, it } from 'vitest'
import { formatShareFragment, MAX_HEADING_INDEX, parseShareFragment } from '../utils/shareFragment'

it.each([
  'BYUwNmD2Q',
  'b1.ABC_-',
  'j1.ABC_-',
  'e1.ABC_-',
])('preserves old payload %s and separates the optional position', (payload) => {
  expect(parseShareFragment(payload)).toEqual({ payload, heading: undefined })
  expect(parseShareFragment(`#${payload}~h=3`)).toEqual({ payload, heading: 3 })
  expect(formatShareFragment(payload, 3)).toBe(`${payload}~h=3`)
  expect(formatShareFragment(payload)).toBe(payload)
})
it.each(['0', '-1', '01', '1.5', 'abc', '', '2~h=3', '%33'])('rejects malformed position %s', (suffix) => {
  expect(() => parseShareFragment(`b1.ABC~h=${suffix}`)).toThrow()
})
it('bounds positions and never splits decoded payload text', () => {
  expect(() => formatShareFragment('b1.ABC', MAX_HEADING_INDEX + 1)).toThrow()
  expect(() => parseShareFragment('~h=1')).toThrow()
  expect(() => parseShareFragment('b1.ABC~other=1')).toThrow()
  expect(parseShareFragment('ABC%7Eh%3D2').payload).toBe('ABC%7Eh%3D2')
})
