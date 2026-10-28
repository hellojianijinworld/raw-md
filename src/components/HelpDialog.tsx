import { ArrowRight, BookOpen, Check, Copy, Sparkles, X } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { translate as t } from '../i18n/core'
import { useI18n } from '../i18n/useI18n'

interface Props {
  anchor: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onCopy: (text: string) => Promise<boolean>
  copying: boolean
}

export default function HelpDialog({ anchor, onClose, onCopy, copying }: Props) {
  useI18n()
  const setupPrompt = t('help.setupPrompt')

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
      <div
        ref={panel}
        className="help-dialog help-dialog-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-heading"
      >
        <header className="help-header">
          <div>
            <BookOpen size={19} />
            <h2 id="help-heading">{t('common.help')}</h2>
          </div>
          <button ref={close} type="button" className="btn btn-icon" aria-label={t('help.close')} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="help-tabs" role="tablist" aria-label={t('help.tabs')}>
          {(
            [
              ['guide', t('help.guide')],
              ['ai', t('help.ai')],
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
              {value === 'ai' && <span className="help-optional">{t('common.optional')}</span>}
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
              <p className="help-eyebrow">{t('help.eyebrow')}</p>
              <h3>{t('help.title')}</h3>
              <p className="help-lead">{t('help.lead')}</p>
              <ol className="help-guide-steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>{t('help.write')}</strong>
                    <p>{t('help.writeText')}</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>{t('help.makeLink')}</strong>
                    <p>{t('help.makeLinkText')}</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>{t('help.sendLink')}</strong>
                    <p>{t('help.sendLinkText')}</p>
                  </div>
                </li>
              </ol>
              <div className="help-note">
                <strong>{t('help.urlTitle')}</strong>
                <p>{t('help.urlText')}</p>
              </div>
              <button type="button" className="btn help-ai-entry" onClick={() => setTab('ai')}>
                <Sparkles size={16} />
                {t('help.aiEntry')}
                <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <p className="help-eyebrow">
                <Sparkles size={15} />
                {t('help.aiEyebrow')}
              </p>
              <h3>{t('help.aiTitle')}</h3>
              <p className="help-lead">{t('help.aiLead')}</p>
              <section className="help-setup">
                <h4>{t('help.setupTitle')}</h4>
                <p>{t('help.setupText')}</p>
                <textarea
                  id="ai-setup-prompt"
                  aria-label={t('help.setupLabel')}
                  readOnly
                  value={setupPrompt}
                  rows={3}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={copying}
                  aria-busy={copying}
                  onClick={async () => setCopyStatus((await onCopy(setupPrompt)) ? 'copied' : 'error')}
                >
                  {copyStatus === 'copied' ? <Check size={16} /> : <Copy size={16} />}
                  {copying ? t('common.copying') : copyStatus === 'copied' ? t('common.copied') : t('help.copySetup')}
                </button>
                {copyStatus !== 'idle' && (
                  <p className="help-caption" role={copyStatus === 'error' ? 'alert' : 'status'}>
                    {copyStatus === 'copied' ? t('help.pasteSetup') : t('help.copyError')}
                  </p>
                )}
              </section>
              <section className="help-examples">
                <h4>{t('help.examples')}</h4>
                <ul>
                  <li>
                    <strong>{t('help.summarize')}</strong>
                    <p>{t('help.summarizePrompt')}</p>
                  </li>
                  <li>
                    <strong>{t('help.discuss')}</strong>
                    <p>{t('help.discussPrompt')}</p>
                  </li>
                  <li>
                    <strong>{t('help.share')}</strong>
                    <p>{t('help.sharePrompt')}</p>
                  </li>
                </ul>
              </section>
              <p className="help-caption">{t('help.aiPrivacy')}</p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
