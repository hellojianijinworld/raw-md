import { useCallback, useEffect, useRef, useState } from 'react'
import MarkdownEditor from './components/MarkdownEditor'
import MarkdownViewer from './components/MarkdownViewer'
import SharePopover from './components/SharePopover'
import Toolbar, { type CopyStatus } from './components/Toolbar'
import UnlockDocument from './components/UnlockDocument'
import { useTheme } from './hooks/useTheme'
import { generateSharePassword, type ShareMode } from './utils/password'
import {
  copyShareUrlToClipboard,
  decodeMarkdownFromHash,
  encodeMarkdownToHash,
  isEditMode,
  isEncryptedHash,
} from './utils/url'

function App() {
  const [markdown, setMarkdown] = useState('')
  const [editMode, setEditMode] = useState<boolean>(() => isEditMode())
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [copyingPassword, setCopyingPassword] = useState(false)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'locked' | 'error'>(() =>
    window.location.hash ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareMode, setShareMode] = useState<ShareMode>('plain')
  const protectedLink = shareMode !== 'plain'
  const [password, setPassword] = useState('')
  const [linkLength, setLinkLength] = useState<number>()
  const [privateDraftPending, setPrivateDraftPending] = useState(false)
  const { mode: colorMode, toggleTheme } = useTheme()
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  const lastCopiedRef = useRef<string>(markdown)
  const revisionRef = useRef(0)
  const privateDraftRef = useRef(false)
  const loadControllerRef = useRef<AbortController | null>(null)
  const copyControllerRef = useRef<AbortController | null>(null)
  const passwordCopyPendingRef = useRef(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isDirty = markdown !== lastCopiedRef.current
  const closeShare = useCallback(() => setShareOpen(false), [])

  const loadDocument = useCallback(async (unlockPassword?: string) => {
    loadControllerRef.current?.abort()
    const controller = new AbortController()
    loadControllerRef.current = controller
    const encrypted = isEncryptedHash()
    setLoadError('')
    setUnlocking(false)
    if (encrypted) {
      setLoadState('locked')
      if (unlockPassword === undefined) return
      setUnlocking(true)
    } else {
      setLoadState('loading')
    }
    try {
      const content = await decodeMarkdownFromHash(controller.signal, unlockPassword)
      if (controller.signal.aborted) return
      setMarkdown(content)
      lastCopiedRef.current = content
      privateDraftRef.current = encrypted
      setShareMode(encrypted ? 'custom' : 'plain')
      setPassword(unlockPassword ?? '')
      setEditMode(!content || isEditMode())
      setLinkLength(
        window.location.hash
          ? `${window.location.origin}${window.location.pathname}${window.location.hash}`.length
          : undefined,
      )
      setPrivateDraftPending(false)
      setLoadState('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      setLoadError(error instanceof Error ? error.message : '공유 링크를 확인해주세요.')
      setLoadState(encrypted ? 'locked' : 'error')
    } finally {
      if (!controller.signal.aborted) setUnlocking(false)
    }
  }, [])

  useEffect(() => {
    const handleHashChange = () => {
      copyControllerRef.current?.abort()
      copyControllerRef.current = null
      clearTimeout(copyTimerRef.current)
      revisionRef.current++
      setShareOpen(false)
      setCopyStatus('idle')
      setPassword('')
      setMarkdown('')
      setPrivateDraftPending(false)
      void loadDocument()
    }
    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      loadControllerRef.current?.abort()
      copyControllerRef.current?.abort()
      clearTimeout(copyTimerRef.current)
    }
  }, [loadDocument])

  useEffect(() => {
    if (!privateDraftPending) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [privateDraftPending])

  const handleMarkdownChange = useCallback((value: string) => {
    revisionRef.current++
    setMarkdown(value)
    setLinkLength(undefined)
    // Protected drafts stay in memory until the user explicitly shares them again.
    if (privateDraftRef.current) setPrivateDraftPending(true)
    else window.history.replaceState(null, '', `#${encodeMarkdownToHash(value)}`)
  }, [])

  const toggleEditMode = useCallback(() => {
    const newMode = !editMode
    setEditMode(newMode)
    const params = new URLSearchParams(window.location.search)
    if (newMode) params.set('edit', 'true')
    else params.delete('edit')
    const newSearch = params.toString()
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash,
    )
  }, [editMode])

  const handleShareModeChange = (mode: ShareMode) => {
    if (copyControllerRef.current || mode === shareMode) return
    const enabled = mode !== 'plain'
    setShareMode(mode)
    setCopyStatus('idle')
    setLinkLength(undefined)
    if (mode === 'secure') setPassword(generateSharePassword())
    if (enabled) {
      privateDraftRef.current = true
      if (!isEncryptedHash()) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        setPrivateDraftPending(true)
      }
    } else {
      setPassword('')
    }
    if (privateDraftRef.current) setPrivateDraftPending(true)
  }

  const handleCopyPassword = async (): Promise<boolean> => {
    if (passwordCopyPendingRef.current || copyControllerRef.current || !password) return false
    passwordCopyPendingRef.current = true
    setCopyingPassword(true)
    try {
      await navigator.clipboard.writeText(password)
      return true
    } catch {
      return false
    } finally {
      passwordCopyPendingRef.current = false
      setCopyingPassword(false)
    }
  }

  const handleCopyUrl = async () => {
    if (passwordCopyPendingRef.current || copyControllerRef.current || (protectedLink && !password)) return
    const controller = new AbortController()
    copyControllerRef.current = controller
    const revision = revisionRef.current
    clearTimeout(copyTimerRef.current)
    setCopyStatus('compressing')
    const url = await copyShareUrlToClipboard(markdown, controller.signal, protectedLink ? password : undefined)
    if (copyControllerRef.current === controller) copyControllerRef.current = null
    if (controller.signal.aborted) return
    setCopyStatus(url ? 'copied' : 'error')
    if (url) {
      lastCopiedRef.current = markdown
      if (revision === revisionRef.current) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search + new URL(url).hash)
        privateDraftRef.current = protectedLink
        setPrivateDraftPending(false)
        setLinkLength(url.length)
      }
    }
    copyTimerRef.current = setTimeout(() => setCopyStatus('idle'), 2000)
  }

  return (
    <div className="app">
      <Toolbar
        isEditing={editMode}
        onToggleEdit={toggleEditMode}
        onToggleShare={() => setShareOpen(!shareOpen)}
        shareOpen={shareOpen}
        shareButtonRef={shareButtonRef}
        isDirty={isDirty || privateDraftPending}
        themeMode={colorMode}
        onToggleTheme={toggleTheme}
        disabled={loadState !== 'ready'}
      />
      {shareOpen && (
        <SharePopover
          anchor={shareButtonRef}
          markdown={markdown}
          mode={shareMode}
          password={password}
          status={copyStatus}
          copyingPassword={copyingPassword}
          linkLength={linkLength}
          onModeChange={handleShareModeChange}
          onPasswordChange={(value) => {
            setPassword(value)
            setCopyStatus('idle')
            setLinkLength(undefined)
            if (privateDraftRef.current) setPrivateDraftPending(true)
          }}
          onCopy={handleCopyUrl}
          onCopyPassword={handleCopyPassword}
          onClose={closeShare}
        />
      )}
      {loadState === 'ready' && privateDraftPending && (
        <p className="private-draft-note">
          변경 사항이 링크에 반영되지 않았습니다. 보관하려면 링크를 다시 복사해주세요.
        </p>
      )}
      {loadState === 'locked' ? (
        <UnlockDocument key={window.location.hash} busy={unlocking} error={loadError} onUnlock={loadDocument} />
      ) : loadState === 'loading' ? (
        <div className="document-status" role="status">
          문서를 불러오는 중...
        </div>
      ) : loadState === 'error' ? (
        <div className="document-status" role="alert">
          <p>문서를 열지 못했습니다.</p>
          <p>{loadError}</p>
        </div>
      ) : editMode ? (
        <MarkdownEditor content={markdown} onChange={handleMarkdownChange} />
      ) : (
        <div className="viewer-container">
          <MarkdownViewer content={markdown} />
        </div>
      )}
    </div>
  )
}

export default App
