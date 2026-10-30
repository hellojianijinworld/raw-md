export function countCharacters(text: string): { count: number; approximate: boolean } {
  let asciiCount = 0
  let ascii = true
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code > 127) {
      ascii = false
      break
    }
    if (code !== 10 || text.charCodeAt(index - 1) !== 13) asciiCount++
  }
  if (ascii) return { count: asciiCount, approximate: false }

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    let count = 0
    for (const _ of segmenter.segment(text)) count++
    return { count, approximate: false }
  }

  let count = 0
  let previous = ''
  for (const char of text) {
    if (char !== '\n' || previous !== '\r') count++
    previous = char
  }
  return { count, approximate: true }
}
