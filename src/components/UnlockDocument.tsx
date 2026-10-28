import { LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { localizeMessage, translate as t } from '../i18n/core'
import { useI18n } from '../i18n/useI18n'
import { documentSecretInput } from '../utils/documentSecret'

export default function UnlockDocument({
  busy,
  error,
  onUnlock,
}: {
  busy: boolean
  error: string
  onUnlock: (password: string) => void
}) {
  useI18n()

  const [password, setPassword] = useState('')
  return (
    <div className="unlock-container">
      <form
        className="unlock-card"
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault()
          onUnlock(password)
        }}
      >
        <LockKeyhole size={28} aria-hidden="true" />
        <h2>{t('document.lockedTitle')}</h2>
        <p className="share-note">{t('document.unlockHint')}</p>
        <label htmlFor="document-unlock-key">{t('common.password')}</label>
        <input
          id="document-unlock-key"
          name="document-unlock-key"
          type="password"
          {...documentSecretInput}
          required
          value={password}
          disabled={busy}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby={error ? 'unlock-error' : undefined}
        />
        <button type="submit" className="btn share-copy" disabled={busy || !password} aria-busy={busy}>
          {busy ? t('document.unlocking') : t('document.unlock')}
        </button>
        {busy && (
          <p className="share-note" role="status">
            {t('document.restoring')}
          </p>
        )}
        {error && (
          <p id="unlock-error" className="share-feedback" role="alert">
            {localizeMessage(error)}
          </p>
        )}
      </form>
    </div>
  )
}
