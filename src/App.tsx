import { useCallback, useEffect, useRef, useState } from 'react'
import DocumentLibrary from './components/DocumentLibrary'
import HelpDialog from './components/HelpDialog'
import MarkdownEditor from './components/MarkdownEditor'
import MarkdownViewer from './components/MarkdownViewer'
import SharePopover from './components/SharePopover'
import Toolbar, { type CopyStatus } from './components/Toolbar'
import UnlockDocument from './components/UnlockDocument'
import { useTheme } from './hooks/useTheme'
import { localizedError, localizeMessage, translate as t } from './i18n/core'
import { useI18n } from './i18n/useI18n'
import { runCompressionTask } from './utils/compression'
import {
  listDocuments,
  protectOpenLink,
  putDocument,
  type StoredDocument,
  setActiveDocument,
} from './utils/documentStorage'
import { downloadMarkdown } from './utils/downloadMarkdown'
import { generateSharePassword, type ShareMode } from './utils/password'
import { parseShareFragment } from './utils/shareFragment'
import {
  copyShareUrlToClipboard,
  decodeMarkdownFromHash,
  encodeMarkdownToHash,
  generateShareUrl,
  isEditMode,
  isEncryptedHash,
} from './utils/url'

function App() {
  const { locale } = useI18n()
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const [markdown, setMarkdown] = useState('')
  const [editMode, setEditMode] = useState<boolean>(() => isEditMode())
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [copyingText, setCopyingText] = useState(false)
  const [savingDocument, setSavingDocument] = useState(false)
  const [documentSaved, setDocumentSaved] = useState(false)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'locked' | 'error'>(() =>
    window.location.hash ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [downloadNotice, setDownloadNotice] = useState('')
  const pendingDownloadPayloadRef = useRef<string | null>(null)
  const unlockedDocumentRef = useRef<{ payload: string; password: string } | null>(null)
  const [shareMode, setShareMode] = useState<ShareMode>('plain')
  const protectedLink = shareMode !== 'plain'
  const [password, setPassword] = useState('')
  const [linkLength, setLinkLength] = useState<number>()
  const [privateDraftPending, setPrivateDraftPending] = useState(false)
  const { mode: colorMode, setThemeMode } = useTheme()
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const libraryReturnFocusRef = useRef<HTMLElement | null>(null)
  const lastCopiedRef = useRef<string>(markdown)
  const revisionRef = useRef(0)
  const privateDraftRef = useRef(false)
  const documentPayloadRef = useRef<string | undefined>(undefined)
  const activeDocumentRef = useRef<string | null>(null)
  const selectedDocumentRef = useRef<{ id: string; payload: string } | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingSaveRef = useRef<StoredDocument | null>(null)
  const pendingWritesRef = useRef(0)
  const failedSaveIdsRef = useRef(new Set<string>())
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const tabIdRef = useRef('')
  const loadControllerRef = useRef<AbortController | null>(null)
  const copyControllerRef = useRef<AbortController | null>(null)
  const textCopyPendingRef = useRef(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isDirty = markdown !== lastCopiedRef.current
  const closeShare = useCallback(() => setShareOpen(false), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])
  const closeLibrary = useCallback(() => setLibraryOpen(false), [])

  useEffect(() => {
    if (!downloadNotice) return
    const timer = setTimeout(() => setDownloadNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [downloadNotice])

  const updateActiveDocument = useCallback((id: string | null) => {
    activeDocumentRef.current = id
    if (typeof indexedDB === 'undefined') return
    if (!tabIdRef.current) tabIdRef.current = crypto.randomUUID()
    const tabId = tabIdRef.current
    saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(() => setActiveDocument(tabId, id))
    void saveQueueRef.current.catch(() => setStorageError(t('storage.stateError')))
  }, [])

  const enqueueSave = useCallback((doc: StoredDocument) => {
    if (typeof indexedDB === 'undefined') {
      setStorageError(t('storage.unavailable'))
      return
    }
    pendingWritesRef.current++
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() =>
        putDocument(doc, { activeIds: [doc.id, ...(activeDocumentRef.current ? [activeDocumentRef.current] : [])] }),
      )
    void saveQueueRef.current.then(
      () => {
        pendingWritesRef.current--
        failedSaveIdsRef.current.delete(doc.id)
        if (!failedSaveIdsRef.current.size) setStorageError('')
      },
      () => {
        pendingWritesRef.current--
        failedSaveIdsRef.current.add(doc.id)
        setStorageError(t('storage.saveError'))
      },
    )
  }, [])

  const flushPendingSave = useCallback(() => {
    clearTimeout(saveTimerRef.current)
    const pending = pendingSaveRef.current
    pendingSaveRef.current = null
    if (pending) enqueueSave(pending)
  }, [enqueueSave])

  const openLibrary = useCallback(() => {
    libraryReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setShareOpen(false)
    setHelpOpen(false)
    flushPendingSave()
    void saveQueueRef.current.catch(() => {}).then(() => setLibraryOpen(true))
  }, [flushPendingSave])

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.shiftKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 'k'
      )
        return
      event.preventDefault()
      if (event.repeat) return
      if (libraryOpen) closeLibrary()
      else openLibrary()
    }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  }, [libraryOpen, openLibrary, closeLibrary])

  useEffect(() => {
    const timer = setInterval(() => {
      if (activeDocumentRef.current) updateActiveDocument(activeDocumentRef.current)
    }, 60_000)
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!pendingSaveRef.current && !pendingWritesRef.current && !failedSaveIdsRef.current.size) return
      event.preventDefault()
      event.returnValue = ''
    }
    const release = () => {
      flushPendingSave()
      if (tabIdRef.current && typeof indexedDB !== 'undefined')
        void saveQueueRef.current
          .catch(() => {})
          .then(() => setActiveDocument(tabIdRef.current, null))
          .catch(() => {})
    }
    const resume = () => {
      if (activeDocumentRef.current) updateActiveDocument(activeDocumentRef.current)
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('pagehide', release)
    window.addEventListener('pageshow', resume)
    return () => {
      clearInterval(timer)
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('pagehide', release)
      window.removeEventListener('pageshow', resume)
      flushPendingSave()
      updateActiveDocument(null)
    }
  }, [flushPendingSave, updateActiveDocument])

  const rememberDocument = useCallback(
    (payload: string, encrypted: boolean, content: string) => {
      if (typeof indexedDB === 'undefined' || !payload) return
      const selected = selectedDocumentRef.current?.payload === payload ? selectedDocumentRef.current.id : null
      selectedDocumentRef.current = null
      const tentativeId = selected ?? crypto.randomUUID()
      updateActiveDocument(tentativeId)
      const revision = revisionRef.current
      void listDocuments()
        .then((all) => {
          if (revisionRef.current !== revision || activeDocumentRef.current !== tentativeId) return
          const existing =
            all.find((doc) => doc.id === selected) ??
            all.find((doc) => doc.kind === 'link' && doc.value === payload) ??
            (!encrypted ? all.find((doc) => doc.kind === 'draft' && doc.value === content) : undefined)
          const id = existing?.id ?? tentativeId
          updateActiveDocument(id)
          enqueueSave(
            existing?.kind === 'draft'
              ? { ...existing, updatedAt: Date.now() }
              : {
                  id,
                  kind: 'link',
                  value: payload,
                  content: encrypted ? undefined : content,
                  title: encrypted ? t('document.lockedTitle') : documentTitle(content),
                  updatedAt: Date.now(),
                  pinned: existing?.pinned ?? false,
                },
          )
        })
        .catch(() => setStorageError(t('storage.saveError')))
    },
    [enqueueSave, updateActiveDocument],
  )

  const loadDocument = useCallback(
    async (unlockPassword?: string) => {
      loadControllerRef.current?.abort()
      const controller = new AbortController()
      loadControllerRef.current = controller
      const encrypted = isEncryptedHash()
      setLoadError('')
      setUnlocking(false)
      if (encrypted) {
        setLoadState('locked')
        if (unlockPassword === undefined) {
          if (!activeDocumentRef.current && typeof indexedDB !== 'undefined') {
            const payload = parseShareFragment(window.location.hash).payload
            if (!tabIdRef.current) tabIdRef.current = crypto.randomUUID()
            const tabId = tabIdRef.current
            saveQueueRef.current = saveQueueRef.current
              .catch(() => {})
              .then(async () => {
                const id = await protectOpenLink(tabId, payload)
                if (id && documentPayloadRef.current === payload && !activeDocumentRef.current)
                  activeDocumentRef.current = id
                else if (id) await setActiveDocument(tabId, activeDocumentRef.current)
              })
            void saveQueueRef.current.catch(() => setStorageError(t('storage.stateError')))
          }
          return
        }
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
        const payload = parseShareFragment(window.location.hash).payload
        unlockedDocumentRef.current = encrypted ? { payload, password: unlockPassword ?? '' } : null
        rememberDocument(payload, encrypted, content)
        if (pendingDownloadPayloadRef.current === payload) {
          pendingDownloadPayloadRef.current = null
          try {
            downloadMarkdown(content, documentTitle(content))
            setDownloadNotice(t('library.downloadStarted'))
          } catch {
            setDownloadNotice(t('library.downloadError'))
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return
        setLoadError(localizedError(error, encrypted ? 'error.unlock' : 'document.checkLink'))
        setLoadState(encrypted ? 'locked' : 'error')
      } finally {
        if (!controller.signal.aborted) setUnlocking(false)
      }
    },
    [rememberDocument],
  )

  useEffect(() => {
    const handleHashChange = () => {
      let payload: string
      try {
        payload = parseShareFragment(window.location.hash).payload
      } catch {
        payload = window.location.hash
      }
      // Heading-only navigation must not discard a password, draft, or running decode.
      if (documentPayloadRef.current === payload) return
      flushPendingSave()
      documentPayloadRef.current = payload
      if (unlockedDocumentRef.current?.payload !== payload) unlockedDocumentRef.current = null
      if (pendingDownloadPayloadRef.current !== payload) pendingDownloadPayloadRef.current = null
      if (selectedDocumentRef.current?.payload !== payload) selectedDocumentRef.current = null
      updateActiveDocument(selectedDocumentRef.current?.id ?? null)
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
    window.addEventListener('popstate', handleHashChange)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('popstate', handleHashChange)
      loadControllerRef.current?.abort()
      documentPayloadRef.current = undefined
      copyControllerRef.current?.abort()
      clearTimeout(copyTimerRef.current)
    }
  }, [loadDocument, updateActiveDocument, flushPendingSave])

  useEffect(() => {
    if (!privateDraftPending) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [privateDraftPending])

  const handleMarkdownChange = useCallback(
    (value: string) => {
      revisionRef.current++
      setDocumentSaved(false)
      setMarkdown(value)
      setLinkLength(undefined)
      // Protected drafts stay in memory until the user explicitly shares them again.
      if (privateDraftRef.current) {
        setPrivateDraftPending(true)
        const payload = parseShareFragment(window.location.hash).payload
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search + (payload ? `#${payload}` : ''),
        )
      } else {
        const payload = encodeMarkdownToHash(value)
        documentPayloadRef.current = payload
        window.history.replaceState(null, '', `#${payload}`)
        if (value || activeDocumentRef.current) {
          const id = activeDocumentRef.current ?? crypto.randomUUID()
          if (activeDocumentRef.current !== id) updateActiveDocument(id)
          clearTimeout(saveTimerRef.current)
          pendingSaveRef.current = {
            id,
            kind: 'draft',
            value,
            title: documentTitle(value),
            updatedAt: Date.now(),
            pinned: false,
          }
          saveTimerRef.current = setTimeout(flushPendingSave, 400)
        }
      }
    },
    [flushPendingSave, updateActiveDocument],
  )

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
    revisionRef.current++
    const enabled = mode !== 'plain'
    setShareMode(mode)
    setCopyStatus('idle')
    setDocumentSaved(false)
    setLinkLength(undefined)
    if (mode === 'secure') setPassword(generateSharePassword())
    if (enabled) {
      clearTimeout(saveTimerRef.current)
      pendingSaveRef.current = null
      updateActiveDocument(null)
      privateDraftRef.current = true
      if (!isEncryptedHash()) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        documentPayloadRef.current = ''
        setPrivateDraftPending(true)
      }
    } else {
      setPassword('')
    }
    if (privateDraftRef.current) setPrivateDraftPending(true)
  }

  const handleCopyText = async (text: string): Promise<boolean> => {
    if (textCopyPendingRef.current || copyControllerRef.current || !text) return false
    textCopyPendingRef.current = true
    setCopyingText(true)
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    } finally {
      textCopyPendingRef.current = false
      setCopyingText(false)
    }
  }

  const handleCopyUrl = async () => {
    if (textCopyPendingRef.current || copyControllerRef.current || (protectedLink && !password)) return
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
        documentPayloadRef.current = parseShareFragment(new URL(url).hash).payload
        privateDraftRef.current = protectedLink
        unlockedDocumentRef.current = protectedLink ? { payload: documentPayloadRef.current!, password } : null
        setPrivateDraftPending(false)
        setLinkLength(url.length)
        if (protectedLink) rememberDocument(parseShareFragment(new URL(url).hash).payload, true, '')
      }
    }
    copyTimerRef.current = setTimeout(() => setCopyStatus('idle'), 2000)
  }

  const handleSaveProtected = async () => {
    if (savingDocument || copyControllerRef.current || !password || typeof indexedDB === 'undefined') {
      if (typeof indexedDB === 'undefined') setStorageError(t('storage.unavailableShort'))
      return
    }
    const revision = revisionRef.current
    const passwordSnapshot = password
    setSavingDocument(true)
    setDocumentSaved(false)
    try {
      const url = await generateShareUrl(markdown, undefined, passwordSnapshot)
      const payload = parseShareFragment(new URL(url).hash).payload
      const id = crypto.randomUUID()
      await putDocument(
        { id, kind: 'link', value: payload, title: t('document.lockedTitle'), updatedAt: Date.now(), pinned: false },
        { activeIds: activeDocumentRef.current ? [activeDocumentRef.current, id] : [id] },
      )
      setStorageError('')
      if (revision === revisionRef.current && passwordSnapshot === password) {
        updateActiveDocument(id)
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${payload}`)
        documentPayloadRef.current = payload
        unlockedDocumentRef.current = { payload, password: passwordSnapshot }
        privateDraftRef.current = true
        setPrivateDraftPending(false)
        setLinkLength(url.length)
        setDocumentSaved(true)
      }
    } catch {
      setStorageError(t('storage.encryptedSaveError'))
    } finally {
      setSavingDocument(false)
    }
  }

  const openStoredDocument = (doc: StoredDocument): boolean => {
    if (privateDraftPending && !window.confirm(t('document.discardConfirm'))) return false
    const payload = doc.kind === 'draft' ? encodeMarkdownToHash(doc.value) : doc.value
    if (payload === documentPayloadRef.current) {
      selectedDocumentRef.current = null
      updateActiveDocument(doc.id)
      if (doc.kind === 'draft') setEditMode(true)
      setLibraryOpen(false)
      return true
    }
    selectedDocumentRef.current = { id: doc.id, payload }
    window.history.pushState(
      null,
      '',
      `${window.location.pathname}${doc.kind === 'draft' ? '?edit=true' : ''}#${payload}`,
    )
    setLibraryOpen(false)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return true
  }

  const downloadStoredDocument = async (doc: StoredDocument): Promise<boolean> => {
    setDownloadNotice('')
    if (doc.kind === 'link' && isEncryptedHash(doc.value)) {
      if (documentPayloadRef.current === doc.value && loadState === 'ready') {
        const content = await runCompressionTask({
          action: 'decode',
          value: doc.value,
          password: unlockedDocumentRef.current?.password ?? password,
        })
        downloadMarkdown(content, documentTitle(content))
        return true
      }
      pendingDownloadPayloadRef.current = doc.value
      if (!openStoredDocument(doc)) pendingDownloadPayloadRef.current = null
      return false
    }
    const content =
      doc.kind === 'draft'
        ? doc.value
        : (doc.content ?? (await runCompressionTask({ action: 'decode', value: doc.value })))
    downloadMarkdown(content, doc.title)
    return true
  }

  return (
    <div className="app" inert={helpOpen || libraryOpen}>
      <Toolbar
        isEditing={editMode}
        onToggleEdit={toggleEditMode}
        onToggleShare={() => {
          setHelpOpen(false)
          setShareOpen(!shareOpen)
        }}
        shareOpen={shareOpen}
        shareButtonRef={shareButtonRef}
        helpButtonRef={helpButtonRef}
        onToggleHelp={() => {
          setShareOpen(false)
          setHelpOpen(!helpOpen)
        }}
        onOpenLibrary={openLibrary}
        isDirty={isDirty || privateDraftPending}
        themeMode={colorMode}
        onThemeChange={setThemeMode}
        disabled={loadState !== 'ready'}
      />
      {libraryOpen && (
        <DocumentLibrary
          onClose={closeLibrary}
          returnFocus={libraryReturnFocusRef}
          onOpen={(doc) => {
            pendingDownloadPayloadRef.current = null
            openStoredDocument(doc)
          }}
          onDownload={downloadStoredDocument}
        />
      )}
      {helpOpen && (
        <HelpDialog
          anchor={helpButtonRef}
          onClose={closeHelp}
          onCopy={handleCopyText}
          copying={copyStatus === 'compressing' || copyingText}
        />
      )}
      {shareOpen && (
        <SharePopover
          anchor={shareButtonRef}
          markdown={markdown}
          mode={shareMode}
          password={password}
          status={copyStatus}
          copyingPassword={copyingText}
          savingDocument={savingDocument}
          documentSaved={documentSaved}
          linkLength={linkLength}
          onModeChange={handleShareModeChange}
          onPasswordChange={(value) => {
            revisionRef.current++
            setPassword(value)
            setDocumentSaved(false)
            setCopyStatus('idle')
            setLinkLength(undefined)
            if (privateDraftRef.current) setPrivateDraftPending(true)
          }}
          onCopy={handleCopyUrl}
          onCopyPassword={() => handleCopyText(password)}
          onSaveDocument={handleSaveProtected}
          onClose={closeShare}
        />
      )}
      {loadState === 'ready' && privateDraftPending && (
        <p className="private-draft-note">{t('document.privateDraft')}</p>
      )}
      {storageError && (
        <p className="private-draft-note" role="alert">
          {localizeMessage(storageError)}
        </p>
      )}
      {downloadNotice && (
        <p className="private-draft-note" role="status">
          {localizeMessage(downloadNotice)}
        </p>
      )}
      {loadState === 'locked' ? (
        <UnlockDocument key={documentPayloadRef.current} busy={unlocking} error={loadError} onUnlock={loadDocument} />
      ) : loadState === 'loading' ? (
        <div className="document-status" role="status">
          {t('document.loading')}
        </div>
      ) : loadState === 'error' ? (
        <div className="document-status" role="alert">
          <p>{t('document.loadError')}</p>
          <p>{localizeMessage(loadError)}</p>
        </div>
      ) : editMode ? (
        <MarkdownEditor content={markdown} onChange={handleMarkdownChange} sectionLinksEnabled={!privateDraftPending} />
      ) : (
        <div className="viewer-container">
          <MarkdownViewer content={markdown} sectionLinksEnabled={!privateDraftPending} />
        </div>
      )}
    </div>
  )
}

function documentTitle(markdown: string): string {
  const heading = markdown.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m)?.[1]
  return (heading || markdown.trim().split('\n')[0] || t('common.untitled')).slice(0, 80)
}

export default App
