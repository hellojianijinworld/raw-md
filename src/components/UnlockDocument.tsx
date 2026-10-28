import { LockKeyhole } from 'lucide-react'
import { useState } from 'react'
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
        <h2>비밀번호로 보호된 문서</h2>
        <p className="share-note">공유한 사람이 알려준 비밀번호를 입력해주세요.</p>
        <label htmlFor="document-unlock-key">비밀번호</label>
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
          {busy ? '문서를 여는 중...' : '문서 열기'}
        </button>
        {busy && (
          <p className="share-note" role="status">
            비밀번호를 확인하고 문서를 복원하고 있습니다.
          </p>
        )}
        {error && (
          <p id="unlock-error" className="share-feedback" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
