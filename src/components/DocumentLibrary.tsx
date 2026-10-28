import { Bookmark, Download, FolderOpen, Trash2, X } from 'lucide-react'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
      setError('문서함을 열지 못했습니다. 브라우저 저장소 설정을 확인해주세요.')
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
    `${item.title} ${item.kind === 'draft' ? item.value : (item.content ?? '')}`
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
            <h2 id="library-title">내 문서함</h2>
          </div>
          <button ref={close} type="button" className="btn btn-icon" aria-label="문서함 닫기" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="library-content">
          <p>
            문서함 {formatBytes(usage)}
            {limit !== undefined ? ` / ${formatBytes(limit)}` : ''}
          </p>
          <p className="share-note">이 브라우저에 저장됩니다. 필요한 문서는 다운로드해 보관하세요.</p>
          {notice && <p role="status">{notice}</p>}
          <input
            ref={search}
            className="library-search"
            aria-label="문서 검색"
            placeholder="문서 검색"
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
          {error && <p role="alert">{error}</p>}
          {!filtered.length && (
            <p className="share-note">{query ? '검색 결과가 없습니다.' : '저장된 문서가 없습니다.'}</p>
          )}
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
                  <strong>{item.title}</strong>
                  <span>
                    {new Date(item.updatedAt).toLocaleString('ko-KR')} · {formatBytes(documentSize(item))}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`${item.title} 다운로드`}
                  title="Markdown 파일로 다운로드"
                  disabled={downloading !== null}
                  onClick={() => {
                    setDownloading(item.id)
                    setError('')
                    void onDownload(item)
                      .then((saved) => {
                        if (saved) setNotice('다운로드를 시작했습니다.')
                      })
                      .catch(() => setError('문서를 다운로드하지 못했습니다. 다시 시도해주세요.'))
                      .finally(() => setDownloading(null))
                  }}
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`${item.title} ${item.pinned ? '보관 해제' : '보관하기'}`}
                  aria-pressed={item.pinned}
                  onClick={() => {
                    void setDocumentPinned(item.id, !item.pinned)
                      .then(refresh)
                      .catch(() => setError('보관 상태를 변경하지 못했습니다.'))
                  }}
                >
                  <Bookmark size={16} fill={item.pinned ? '#e3b341' : 'none'} />
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`${item.title} 삭제`}
                  onClick={() => {
                    if (window.confirm('이 문서를 문서함에서 삭제할까요?'))
                      void deleteDocument(item.id)
                        .then(refresh)
                        .catch(() => setError('문서를 삭제하지 못했습니다.'))
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          <p className="share-note library-cleanup-note">
            공간이 부족하면 목록 아래쪽의 오래된 문서부터 자동 삭제될 수 있습니다. 보관한 문서는 제외됩니다.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
