import { ExternalLink, X } from 'lucide-react'
import { useAppUpdate } from '../hooks/useAppUpdate'
import { useI18n } from '../i18n/useI18n'

export default function UpdateNotice() {
  const { t } = useI18n()
  const { update, dismiss } = useAppUpdate()
  if (!update) return null
  return (
    <aside className="update-notice" role="status">
      <div>
        <strong>{t('update.available', { version: update.version })}</strong>
        <p>{t('update.draftKept')}</p>
        <a className="btn btn-sm" href={window.location.href} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} />
          {t('update.open')}
        </a>
      </div>
      <button className="btn btn-icon" type="button" aria-label={t('update.dismiss')} onClick={dismiss}>
        <X size={16} />
      </button>
    </aside>
  )
}
