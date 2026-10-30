import { defaultSchema } from 'rehype-sanitize'

export const SANITIZE_ID_PREFIX = defaultSchema.clobberPrefix ?? 'user-content-'

/**
 * rehype-sanitize 커스텀 스키마
 *
 * 기본 스키마 위에 추가 보안 규칙:
 * - javascript:, data: 프로토콜 차단 (defaultSchema에 이미 포함)
 * - on* 이벤트 핸들러 속성 제거 (defaultSchema에 이미 포함)
 * - GFM 지원 태그 추가 (input, details, summary)
 */
export const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'input', 'details', 'summary'],
  attributes: {
    ...defaultSchema.attributes,
    input: [
      ['checked', 'checked'],
      ['disabled', 'disabled'],
      ['type', 'checkbox'],
    ],
    details: [['open', 'open']],
    // Class allowlists use regular expressions, not wildcard strings.
    code: [['className', /^language-[\w-]+$/]],
    pre: [['className', /^language-[\w-]+$/]],
  },
} as const
