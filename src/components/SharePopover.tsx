import { Check, Copy, Eye, EyeOff, X } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { translate as t } from '../i18n/core'
import { useI18n } from '../i18n/useI18n'
import { documentSecretInput } from '../utils/documentSecret'
import { formatBytes } from '../utils/formatBytes'
import { generateSharePassword, type ShareMode } from '../utils/password'
import type { CopyStatus } from './Toolbar'

interface Props {
  anchor: RefObject<HTMLButtonElement | null>
  markdown: string
  mode: ShareMode
  password: string
  status: CopyStatus
  copyingPassword: boolean
  savingDocument: boolean
  documentSaved: boolean
  linkLength?: number
  onModeChange: (value: ShareMode) => void
  onPasswordChange: (value: string) => void
  onCopy: () => void
  onCopyPassword: () => Promise<boolean>
  onSaveDocument: () => void
  onClose: () => void
}

export default function SharePopover({
  anchor,
  markdown,
  mode,
  password,
  status,
  copyingPassword,
  savingDocument,
  documentSaved,
  linkLength,
  onModeChange,
  onPasswordChange,
  onCopy,
  onCopyPassword,
  onSaveDocument,
  onClose,
}: Props) {
  const { locale } = useI18n()

  const panel = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordCopyStatus, setPasswordCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const passwordRevision = useRef(0)
  const bytes = new TextEncoder().encode(markdown).length
  const busy = status === 'compressing' || savingDocument
  const protectedLink = mode !== 'plain'

  // biome-ignore lint/correctness/useExhaustiveDependencies: A password change resets feedback and invalidates pending clipboard writes.
  useEffect(() => {
    setPasswordCopyStatus('idle')
    return () => {
      passwordRevision.current++
    }
  }, [password])

  const copyPassword = async () => {
    if (!password || busy || copyingPassword) return
    const revision = passwordRevision.current
    setPasswordCopyStatus('idle')
    const copied = await onCopyPassword()
    if (passwordRevision.current === revision) setPasswordCopyStatus(copied ? 'copied' : 'error')
  }

  useEffect(() => {
    const element = panel.current!
    const trigger = anchor.current
    close.current?.focus()
    const outside = (event: Event) => {
      if (event.target instanceof Node && !element.contains(event.target) && !trigger?.contains(event.target)) onClose()
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        trigger?.focus()
        onClose()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', onEscape)
      if (element.contains(document.activeElement)) trigger?.focus()
    }
  }, [anchor, onClose])

  return createPortal(
    <div ref={panel} id="share-popover" className="share-popover" role="dialog" aria-labelledby="share-heading">
      <div className="share-heading">
        <h2 id="share-heading">{t('share.title')}</h2>
        <button
          ref={close}
          type="button"
          className="btn btn-icon"
          aria-label={t('common.close')}
          onClick={() => {
            anchor.current?.focus()
            onClose()
          }}
        >
          <X size={16} />
        </button>
      </div>
      <dl className="share-size">
        <div>
          <dt>
            {t('share.sourceSize')}
            <span>UTF-8</span>
          </dt>
          <dd title={`${bytes.toLocaleString(locale)} B`}>{formatBytes(bytes)}</dd>
        </div>
        {linkLength !== undefined && (
          <div>
            <dt>{t('share.linkLength')}</dt>
            <dd>
              {linkLength.toLocaleString(locale)}
              {t('share.characters')}
            </dd>
          </div>
        )}
      </dl>
      <form
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault()
          onCopy()
        }}
      >
        <fieldset className="share-options">
          <legend>{t('share.mode')}</legend>
          {(
            [
              ['plain', t('share.plain'), t('share.plainDescription')],
              ['protected', t('share.protected'), t('share.protectedDescription')],
            ] as const
          ).map(([value, title, description]) => (
            <label
              key={value}
              className={`share-option${(value === 'plain' ? !protectedLink : protectedLink) ? ' selected' : ''}`}
            >
              <input
                id={value === 'plain' ? 'share-plain' : 'share-protection'}
                type="radio"
                name="share-protection"
                checked={value === 'plain' ? !protectedLink : protectedLink}
                disabled={busy}
                onChange={() => onModeChange(value === 'plain' ? 'plain' : 'custom')}
              />
              <span>
                <strong>{title}</strong>
                <span>{description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {protectedLink && (
          <div className="share-password">
            <div className="share-password-heading">
              <label htmlFor="document-share-key">{t('common.password')}</label>
            </div>
            <div className="password-field">
              <input
                id="document-share-key"
                name="document-share-key"
                type={showPassword ? 'text' : 'password'}
                value={password}
                required
                disabled={busy}
                {...documentSecretInput}
                aria-describedby="password-hint"
                onChange={(event) => {
                  if (mode === 'secure') onModeChange('custom')
                  onPasswordChange(event.target.value)
                }}
              />
              <button
                type="button"
                className="password-visibility"
                aria-label={showPassword ? t('share.hidePassword') : t('share.showPassword')}
                title={showPassword ? t('share.hidePassword') : t('share.showPassword')}
                aria-controls="document-share-key"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <div className="share-password-actions">
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={() => {
                  if (mode === 'secure') onPasswordChange(generateSharePassword())
                  else onModeChange('secure')
                  setShowPassword(true)
                }}
              >
                {mode === 'secure' ? t('share.regenerate') : t('share.generate')}
              </button>
              <button
                type="button"
                className="btn share-password-copy"
                onClick={copyPassword}
                disabled={busy || copyingPassword || !password}
                aria-busy={copyingPassword}
              >
                {passwordCopyStatus === 'copied' ? <Check size={14} /> : <Copy size={14} />}
                {copyingPassword
                  ? t('share.copyingPassword')
                  : passwordCopyStatus === 'copied'
                    ? t('share.passwordCopied')
                    : t('share.copyPassword')}
              </button>
            </div>
            {passwordCopyStatus !== 'idle' && (
              <p className="share-feedback" role={passwordCopyStatus === 'error' ? 'alert' : 'status'}>
                {passwordCopyStatus === 'copied' ? t('share.passwordCopiedNotice') : t('share.passwordCopyError')}
              </p>
            )}
            <p id="password-hint" className="share-note">
              {t('share.passwordHint')}
            </p>
          </div>
        )}
        <p className="share-note">{t('common.noServer')}</p>
        {protectedLink && <p className="share-note">{t('share.plainCopies')}</p>}
        {protectedLink && (
          <button
            type="button"
            className="btn share-copy"
            disabled={busy || copyingPassword || !password || !markdown.trim()}
            onClick={onSaveDocument}
          >
            {savingDocument ? t('share.encrypting') : documentSaved ? t('share.saved') : t('share.encryptSave')}
          </button>
        )}
        <button
          type="submit"
          className="btn share-copy"
          disabled={busy || copyingPassword || (protectedLink && !password)}
          aria-busy={busy}
        >
          {status === 'copied' ? <Check size={16} /> : <Copy size={16} />}
          {busy ? t('share.preparing') : status === 'copied' ? t('common.copied') : t('share.copyLink')}
        </button>
        <p className="share-feedback" role={status === 'error' ? 'alert' : 'status'}>
          {status === 'error'
            ? t('share.copyError')
            : status === 'copied'
              ? t('share.copiedNotice')
              : busy
                ? t('share.compressing')
                : ''}
        </p>
      </form>
    </div>,
    document.body,
  )
}
