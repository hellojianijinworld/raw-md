import { translate as t } from '../i18n/core'

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

// Separate syllable components without normalizing the original Unicode text.
export function packHangul(text: string): Uint8Array {
  const bytes: number[] = []
  for (const char of text) {
    const code = char.codePointAt(0)!
    if (code < 128) {
      bytes.push(code)
    } else if (code >= 0xac00 && code <= 0xd7a3) {
      const syllable = code - 0xac00
      bytes.push(0x80 + Math.floor(syllable / 588), 0xa0 + Math.floor((syllable % 588) / 28), 0xc0 + (syllable % 28))
    } else {
      const encoded = encoder.encode(char)
      bytes.push(0xff, encoded.length, ...encoded)
    }
  }
  return new Uint8Array(bytes)
}

export function unpackHangul(bytes: Uint8Array): string {
  const chars: string[] = []
  for (let i = 0; i < bytes.length; ) {
    const first = bytes[i++]
    if (first < 128) {
      chars.push(String.fromCodePoint(first))
    } else if (first === 0xff) {
      const length = bytes[i++]
      if (!(length >= 1 && length <= 4) || i + length > bytes.length) throw new Error(t('error.damagedLink'))
      chars.push(decoder.decode(bytes.subarray(i, i + length)))
      i += length
    } else {
      const vowel = bytes[i++] - 0xa0
      const final = bytes[i++] - 0xc0
      if (!(first >= 0x80 && first <= 0x92 && vowel >= 0 && vowel < 21 && final >= 0 && final < 28)) {
        throw new Error(t('error.damagedLink'))
      }
      chars.push(String.fromCodePoint(0xac00 + (first - 0x80) * 588 + vowel * 28 + final))
    }
  }
  return chars.join('')
}
