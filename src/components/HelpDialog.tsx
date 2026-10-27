import { ArrowRight, BookOpen, Check, Copy, Sparkles, X } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  anchor: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onCopy: (text: string) => Promise<boolean>
  copying: boolean
}

const setupPrompt = `아래 안내를 읽고, 지금 사용 중인 AI 환경에 raw-md 스킬을 설치해줘.
https://raw-md.pages.dev/ai/INSTALL.md`

export default function HelpDialog({ anchor, onClose, onCopy, copying }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const [tab, setTab] = useState<'guide' | 'ai'>('guide')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  useEffect(() => {
    const trigger = anchor.current
    close.current?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key !== 'Tab') return
      const items = [
        ...panel.current!.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], textarea'),
      ].filter((item) => item.tabIndex !== -1)
      const first = items[0]
      const last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.removeEventListener('keydown', keyboard)
      trigger?.focus()
    }
  }, [anchor, onClose])

  return createPortal(
    <div className="help-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={panel} className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-heading">
        <header className="help-header">
          <div>
            <BookOpen size={19} />
            <h2 id="help-heading">도움말</h2>
          </div>
          <button ref={close} type="button" className="btn btn-icon" aria-label="도움말 닫기" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="help-tabs" role="tablist" aria-label="도움말 항목">
          {(
            [
              ['guide', '사용 방법'],
              ['ai', 'AI 연동'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`help-tab-${value}`}
              aria-controls={`help-panel-${value}`}
              aria-selected={tab === value}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                event.preventDefault()
                const next = value === 'guide' ? 'ai' : 'guide'
                setTab(next)
                panel.current?.querySelector<HTMLButtonElement>(`#help-tab-${next}`)?.focus()
              }}
            >
              {label}
              {value === 'ai' && <span className="help-optional">선택</span>}
            </button>
          ))}
        </div>
        <div
          key={tab}
          className="help-body"
          role="tabpanel"
          id={`help-panel-${tab}`}
          aria-labelledby={`help-tab-${tab}`}
        >
          {tab === 'guide' ? (
            <>
              <p className="help-eyebrow">설치 없이, 링크 하나로</p>
              <h3>웹에서 바로 사용하세요</h3>
              <p className="help-lead">
                마크다운을 작성하고 링크를 공유하세요. 받는 사람은 주소를 열면 문서를 읽을 수 있습니다.
              </p>
              <ol className="help-guide-steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>문서 작성</strong>
                    <p>수정을 눌러 작성하거나 .md 파일을 여세요. 코드, 수식, Mermaid 다이어그램도 표시됩니다.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>링크 만들기</strong>
                    <p>링크 버튼을 누르면 문서의 용량을 확인하고 공유 링크를 만들 수 있습니다.</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>링크 전달</strong>
                    <p>링크 복사를 누른 뒤 원하는 곳에 붙여넣으세요. 받는 사람은 링크를 열면 됩니다.</p>
                  </div>
                </li>
              </ol>
              <div className="help-note">
                <strong>문서가 URL 안에 들어 있습니다.</strong>
                <p>raw-md는 문서를 서버에 저장하지 않습니다. 나중에 다시 열 수 있도록 링크를 보관해주세요.</p>
              </div>
              <button type="button" className="btn help-ai-entry" onClick={() => setTab('ai')}>
                <Sparkles size={16} />
                AI에서 이 문서를 읽고 이어가기
                <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <p className="help-eyebrow">
                <Sparkles size={15} />
                AI 연동 · 선택 기능
              </p>
              <h3>문서 링크를 AI에게 건네세요</h3>
              <p className="help-lead">
                공유받은 문서를 AI가 읽고 함께 논의하거나, 대화에서 정리한 내용을 새 문서 링크로 만들 수 있습니다.
              </p>
              <section className="help-setup">
                <h4>처음 한 번, AI에게 설치 요청</h4>
                <p>아래 문구를 복사해 Codex나 Claude Code에 붙여넣으세요.</p>
                <textarea id="ai-setup-prompt" aria-label="AI 설치 요청 문구" readOnly value={setupPrompt} rows={3} />
                <button
                  type="button"
                  className="btn"
                  disabled={copying}
                  aria-busy={copying}
                  onClick={async () => setCopyStatus((await onCopy(setupPrompt)) ? 'copied' : 'error')}
                >
                  {copyStatus === 'copied' ? <Check size={16} /> : <Copy size={16} />}
                  {copying ? '복사 중...' : copyStatus === 'copied' ? '복사됨' : '설치 요청 복사'}
                </button>
                {copyStatus !== 'idle' && (
                  <p className="help-caption" role={copyStatus === 'error' ? 'alert' : 'status'}>
                    {copyStatus === 'copied'
                      ? 'AI 대화창에 붙여넣고 보내세요.'
                      : '복사하지 못했습니다. 위 문구를 직접 선택해 복사해주세요.'}
                  </p>
                )}
              </section>
              <section className="help-examples">
                <h4>설치 후에는 이렇게 요청하세요</h4>
                <ul>
                  <li>
                    <strong>문서 요약</strong>
                    <p>“이 링크의 내용을 읽고 핵심만 요약해줘. [문서 링크]”</p>
                  </li>
                  <li>
                    <strong>이어서 논의</strong>
                    <p>“이 문서를 바탕으로 다음에 할 일을 함께 정리해줘. [문서 링크]”</p>
                  </li>
                  <li>
                    <strong>결과 공유</strong>
                    <p>“방금 정리한 내용을 raw-md 링크로 만들어줘.”</p>
                  </li>
                </ul>
              </section>
              <p className="help-caption">AI에 전달한 문서는 사용 중인 AI 서비스에서 처리됩니다.</p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
