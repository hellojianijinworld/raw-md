import { Bookmark, Download, FolderOpen, Trash2, X } from 'lucide-react'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { localizeMessage, translate as t } from '../i18n/core'
import { useI18n } from '../i18n/useI18n'
import {
  deleteDocument,
  documentSize,
  listDocuments,
  readStorageEstimate,
  type StoredDocument,
  setDocumentPinned,
  storageBudget,
} from '../utils/documentStorage'
import { formatBytes } from '../utils/formatBytes'
import { isEncryptedHash } from '../utils/url'

function displayTitle(item: StoredDocument): string {
  return item.kind === 'link' && isEncryptedHash(item.value) ? t('document.lockedTitle') : item.title
}

export default function DocumentLibrary({
  onClose,
  onOpen,
  returnFocus,
  onDownload,
}: {
  onClose: () => void
  onOpen: (doc: StoredDocument) => void
  returnFocus: RefObject<HTMLElement | null>
  onDownload: (doc: StoredDocument) => Promise<boolean>
}) {
  const { locale } = useI18n()

  const [items, setItems] = useState<StoredDocument[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [limit, setLimit] = useState<number>()
  const [downloading, setDownloading] = useState<string | null>(null)
  const close = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])
  const refresh = useCallback(async () => {
    try {
      const documents = await listDocuments()
      setItems(documents.sort((a, b) => b.updatedAt - a.updatedAt))
      const used = documents.reduce((sum, doc) => sum + documentSize(doc), 0)
      setLimit(storageBudget(used, await readStorageEstimate()).limit)
    } catch {
      setError(t('library.openError'))
    }
  }, [])
  useEffect(() => {
    void refresh()
    const trigger = returnFocus.current
    search.current?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key !== 'Tab') return
      const controls = [
        ...panel.current!.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'),
      ]
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault()
        controls.at(-1)?.focus()
      } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
        event.preventDefault()
        controls[0]?.focus()
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.removeEventListener('keydown', keyboard)
      if (trigger?.isConnected) trigger.focus()
    }
  }, [onClose, refresh, returnFocus])
  const filtered = items.filter((item) =>
    `${displayTitle(item)} ${item.kind === 'draft' ? item.value : (item.content ?? '')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  const usage = items.reduce((sum, item) => sum + documentSize(item), 0)
  return createPortal(
    <div className="help-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panel}
        className="help-dialog document-library"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-title"
      >
        <header className="help-header">
          <div>
            <FolderOpen size={19} />
            <h2 id="library-title">{t('common.library')}</h2>
          </div>
          <button ref={close} type="button" className="btn btn-icon" aria-label={t('library.close')} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="library-content">
          <p>
            {t('library.name')}
            {formatBytes(usage)}
            {limit !== undefined ? ` / ${formatBytes(limit)}` : ''}
          </p>
          <p className="share-note">{t('library.note')}</p>
          {notice && <p role="status">{localizeMessage(notice)}</p>}
          <input
            ref={search}
            className="library-search"
            aria-label={t('library.search')}
            placeholder={t('library.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return
              if (event.key !== 'ArrowDown' && event.key !== 'Enter') return
              event.preventDefault()
              const first = panel.current?.querySelector<HTMLButtonElement>('.library-open')
              if (event.key === 'Enter') first?.click()
              else first?.focus()
            }}
          />
          {error && <p role="alert">{localizeMessage(error)}</p>}
          {!filtered.length && <p className="share-note">{query ? t('library.noResults') : t('library.empty')}</p>}
          <ul
            className="library-list"
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || !['ArrowDown', 'ArrowUp'].includes(event.key)) return
              const buttons = [...panel.current!.querySelectorAll<HTMLButtonElement>('.library-open')]
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
              if (index < 0) return
              event.preventDefault()
              if (event.key === 'ArrowUp' && index === 0) search.current?.focus()
              else buttons[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus()
            }}
          >
            {filtered.map((item) => (
              <li key={item.id}>
                <button type="button" className="library-open" onClick={() => onOpen(item)}>
                  <strong>{displayTitle(item)}</strong>
                  <span>
                    {new Date(item.updatedAt).toLocaleString(locale)} · {formatBytes(documentSize(item))}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t('library.download', { title: displayTitle(item) })}
                  title={t('library.downloadHint')}
                  disabled={downloading !== null}
                  onClick={() => {
                    setDownloading(item.id)
                    setError('')
                    void onDownload(item)
                      .then((saved) => {
                        if (saved) setNotice(t('library.downloadStarted'))
                      })
                      .catch(() => setError(t('library.downloadError')))
                      .finally(() => setDownloading(null))
                  }}
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t('library.pinLabel', {
                    title: displayTitle(item),
                    action: item.pinned ? t('library.unpin') : t('library.pin'),
                  })}
                  aria-pressed={item.pinned}
                  onClick={() => {
                    void setDocumentPinned(item.id, !item.pinned)
                      .then(refresh)
                      .catch(() => setError(t('library.pinError')))
                  }}
                >
                  <Bookmark size={16} fill={item.pinned ? '#e3b341' : 'none'} />
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t('library.delete', { title: displayTitle(item) })}
                  onClick={() => {
                    if (window.confirm(t('library.deleteConfirm')))
                      void deleteDocument(item.id)
                        .then(refresh)
                        .catch(() => setError(t('library.deleteError')))
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          <p className="share-note library-cleanup-note">{t('library.cleanupNote')}</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
