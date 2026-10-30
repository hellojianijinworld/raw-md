import { translate as t } from '../i18n/core'

// biome-ignore lint/suspicious/noControlCharactersInRegex: File names must exclude control characters.
const INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/g
const RESERVED_FILENAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export function downloadMarkdown(markdown: string, title: string): void {
  let name =
    title
      .replace(INVALID_FILENAME_CHARACTERS, '_')
      .replace(/\.md$/i, '')
      .trim()
      .slice(0, 100)
      .replace(/[. ]+$/, '') || t('common.document')
  if (RESERVED_FILENAME.test(name)) name = `_${name}`
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${name}.md`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
