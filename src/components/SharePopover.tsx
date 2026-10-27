import { Check, Copy, Eye, EyeOff, X } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { generateSharePassword, type ShareMode } from '../utils/password'
import type { CopyStatus } from './Toolbar'

interface Props {
  anchor: RefObject<HTMLButtonElement | null>
  markdown: string
  mode: ShareMode
  password: string
  status: CopyStatus
  copyingPassword: boolean
  linkLength?: number
  onModeChange: (value: ShareMode) => void
  onPasswordChange: (value: string) => void
  onCopy: () => void
  onCopyPassword: () => Promise<boolean>
  onClose: () => void
}

export default function SharePopover({
  anchor,
  markdown,
  mode,
  password,
  status,
  copyingPassword,
  linkLength,
  onModeChange,
  onPasswordChange,
  onCopy,
  onCopyPassword,
  onClose,
}: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordCopyStatus, setPasswordCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const passwordRevision = useRef(0)
  const bytes = new TextEncoder().encode(markdown).length
  const busy = status === 'compressing'
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
        <h2 id="share-heading">링크 공유</h2>
        <button
          ref={close}
          type="button"
          className="btn btn-icon"
          aria-label="닫기"
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
            원문 용량 <span>UTF-8</span>
          </dt>
          <dd>{bytes.toLocaleString('en-US')} bytes</dd>
        </div>
        {linkLength !== undefined && (
          <div>
            <dt>공유 링크 길이</dt>
            <dd>{linkLength.toLocaleString('en-US')}자</dd>
          </div>
        )}
      </dl>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onCopy()
        }}
      >
        <fieldset className="share-options">
          <legend>공유 방식</legend>
          {(
            [
              ['plain', '그냥 공유', '링크가 있으면 누구나 열 수 있습니다.'],
              ['protected', '직접 설정', '비밀번호로 보호합니다. 직접 입력하거나 자동 생성할 수 있습니다.'],
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
              <label htmlFor="share-password">비밀번호</label>
            </div>
            <div className="password-field">
              <input
                id="share-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                required
                disabled={busy}
                autoComplete="new-password"
                aria-describedby="password-hint"
                onChange={(event) => {
                  if (mode === 'secure') onModeChange('custom')
                  onPasswordChange(event.target.value)
                }}
              />
              <button
                type="button"
                className="password-visibility"
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                title={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                aria-controls="share-password"
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
                {mode === 'secure' ? '다시 생성' : '강력한 암호 자동 생성'}
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
                  ? '비밀번호 복사 중...'
                  : passwordCopyStatus === 'copied'
                    ? '비밀번호 복사됨'
                    : '비밀번호 복사'}
              </button>
            </div>
            {passwordCopyStatus !== 'idle' && (
              <p className="share-feedback" role={passwordCopyStatus === 'error' ? 'alert' : 'status'}>
                {passwordCopyStatus === 'copied'
                  ? '비밀번호를 복사했습니다.'
                  : '비밀번호를 복사하지 못했습니다. 다시 시도해주세요.'}
              </p>
            )}
            <p id="password-hint" className="share-note">
              비밀번호는 링크와 별도로 전달해주세요. 잊으면 복구할 수 없습니다.
            </p>
          </div>
        )}
        <p className="share-note">문서는 서버에 저장되지 않습니다.</p>
        <button
          type="submit"
          className="btn share-copy"
          disabled={busy || copyingPassword || (protectedLink && !password)}
          aria-busy={busy}
        >
          {status === 'copied' ? <Check size={16} /> : <Copy size={16} />}
          {busy ? '만드는 중...' : status === 'copied' ? '복사됨' : '공유 링크 복사하기'}
        </button>
        <p className="share-feedback" role={status === 'error' ? 'alert' : 'status'}>
          {status === 'error'
            ? '링크를 만들거나 복사하지 못했습니다. 다시 시도해주세요.'
            : status === 'copied'
              ? '링크를 복사했습니다.'
              : busy
                ? '문서를 압축하고 링크를 준비하고 있습니다.'
                : ''}
        </p>
      </form>
    </div>,
    document.body,
  )
}
