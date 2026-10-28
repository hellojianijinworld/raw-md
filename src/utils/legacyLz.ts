import { translate as t } from '../i18n/core'

/*
Adapted from lz-string (bounded output and dictionary growth).

MIT License

Copyright (c) 2013 pieroxy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// Budgets are checked before growing strings or arrays.
const URI_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$'
const invalid = () => new Error(t('error.legacyLink'))

export function decodeLegacyLz(input: string | Uint8Array, maxCharacters = 4 * 1024 * 1024): string {
  const binary = typeof input !== 'string'
  if (!Number.isSafeInteger(maxCharacters) || maxCharacters < 0 || (binary && input.length % 2)) throw invalid()
  const length = binary ? input.length / 2 : input.length
  let index = 0
  let value = 0
  let position = 0
  const reset = binary ? 32768 : 32
  const bits = (count: number): number => {
    let result = 0
    for (let bit = 0; bit < count; bit++) {
      if (!position) {
        if (index >= length) throw invalid()
        value = binary
          ? (input as Uint8Array)[index * 2] * 256 + (input as Uint8Array)[index * 2 + 1]
          : URI_ALPHABET.indexOf((input as string)[index])
        if (value < 0 || (!binary && value > 63)) throw invalid()
        index++
        position = reset
      }
      if (value & position) result += 2 ** bit
      position >>= 1
    }
    return result
  }
  const first = bits(2)
  if (first === 2) return ''
  if (first !== 0 && first !== 1) throw invalid()
  let previous = String.fromCharCode(bits(first === 0 ? 8 : 16))
  if (!maxCharacters) throw invalid()
  const dictionary = ['', '', '', previous]
  let dictionaryCharacters = 1
  let outputLength = 1
  let enlargeIn = 4
  let numBits = 3
  const output: string[] = []
  let chunk = previous
  const add = (entry: string) => {
    dictionaryCharacters += entry.length
    // Each iteration emits at least one character and adds at most two dictionary entries.
    if (dictionary.length >= maxCharacters * 2 + 4 || dictionaryCharacters > maxCharacters * 3) throw invalid()
    dictionary.push(entry)
  }
  while (true) {
    let code = bits(numBits)
    if (code === 2) {
      output.push(chunk)
      return output.join('')
    }
    if (code === 0 || code === 1) {
      add(String.fromCharCode(bits(code === 0 ? 8 : 16)))
      code = dictionary.length - 1
      enlargeIn--
    }
    if (!enlargeIn) {
      enlargeIn = 2 ** numBits
      numBits++
    }
    let entry = dictionary[code]
    if (!entry) {
      if (code !== dictionary.length || previous.length + 1 > maxCharacters - outputLength) throw invalid()
      entry = previous + previous[0]
    }
    if (entry.length > maxCharacters - outputLength) throw invalid()
    outputLength += entry.length
    if (chunk.length + entry.length > 16384) {
      output.push(chunk)
      chunk = entry
    } else chunk += entry
    // Sum of previous phrase lengths is bounded by emitted output, including repeated dictionary entries.
    if (previous.length + 1 > maxCharacters * 3 - dictionaryCharacters) throw invalid()
    add(previous + entry[0])
    enlargeIn--
    previous = entry
    if (!enlargeIn) {
      enlargeIn = 2 ** numBits
      numBits++
    }
  }
}
