import { FolderOpen } from 'lucide-react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { translate as t } from '../i18n/core'
import { useI18n } from '../i18n/useI18n'
import MarkdownViewer from './MarkdownViewer'

interface MarkdownEditorProps {
  content: string
  onChange: (value: string) => void
  sectionLinksEnabled?: boolean
}

export default function MarkdownEditor({ content, onChange, sectionLinksEnabled }: MarkdownEditorProps) {
  useI18n()

  const isMobile = useMediaQuery('(max-width: 768px) and (orientation: portrait)')

  const handleFileUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        onChange(text)
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // 모바일: 미리보기 없이 에디터만 전체 너비
  if (isMobile) {
    return (
      <div className="editor-layout editor-layout-mobile">
        <div className="editor-pane editor-pane-full">
          <div className="editor-pane-header">
            <button type="button" className="btn btn-sm" onClick={handleFileUpload}>
              <FolderOpen size={14} />
              <span>{t('common.openFile')}</span>
            </button>
          </div>
          <textarea
            className="editor-textarea"
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('editor.placeholder')}
          />
        </div>
      </div>
    )
  }

  // 데스크탑: 기존 분할 레이아웃
  return (
    <div className="editor-layout">
      <div className="editor-pane">
        <div className="editor-pane-header">
          <button type="button" className="btn btn-sm" onClick={handleFileUpload}>
            <FolderOpen size={14} />
            <span>{t('common.openFile')}</span>
          </button>
        </div>
        <textarea
          className="editor-textarea"
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('editor.placeholder')}
        />
      </div>
      <div className="preview-pane">
        <MarkdownViewer content={content} sectionLinksEnabled={sectionLinksEnabled} />
      </div>
    </div>
  )
}
