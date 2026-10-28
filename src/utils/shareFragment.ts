import { translate as t } from '../i18n/core'
/** URL position metadata is outside the unchanged compressed/encrypted payload. */
export const HEADING_FRAGMENT_SEPARATOR = '~h='
export const MAX_HEADING_INDEX = 1_000_000
const HEADING_INDEX_PATTERN = /^[1-9]\d{0,6}$/

export function parseShareFragment(fragment: string): { payload: string; heading?: number } {
  const raw = fragment.startsWith('#') ? fragment.slice(1) : fragment
  const position = raw.indexOf(HEADING_FRAGMENT_SEPARATOR[0])
  if (position === -1) return { payload: raw, heading: undefined }
  const payload = raw.slice(0, position)
  const suffix = raw.slice(position)
  const value = suffix.slice(HEADING_FRAGMENT_SEPARATOR.length)
  if (!payload || !suffix.startsWith(HEADING_FRAGMENT_SEPARATOR) || !HEADING_INDEX_PATTERN.test(value))
    throw new Error(t('error.position'))
  const heading = Number(value)
  if (heading > MAX_HEADING_INDEX) throw new Error(t('error.position'))
  return { payload, heading }
}

export function formatShareFragment(payload: string, heading?: number): string {
  if (parseShareFragment(payload).heading !== undefined) throw new Error(t('error.position'))
  if (heading === undefined) return payload
  if (!payload || !Number.isSafeInteger(heading) || heading < 1 || heading > MAX_HEADING_INDEX)
    throw new Error(t('error.position'))
  return `${payload}${HEADING_FRAGMENT_SEPARATOR}${heading}`
}
