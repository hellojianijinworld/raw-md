import {
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  Eye,
  FolderOpen,
  GitPullRequest,
  Link2,
  Menu,
  Pencil,
  Settings,
} from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { useScrollToolbar } from '../hooks/useScrollToolbar'
import { translate as t } from '../i18n/core'
import { useI18n } from '../i18n/useI18n'

export type CopyStatus = 'idle' | 'compressing' | 'copied' | 'error'

interface ToolbarProps {
  isEditing: boolean
  onToggleEdit: () => void
  onToggleShare: () => void
  shareOpen: boolean
  shareButtonRef: RefObject<HTMLButtonElement | null>
  helpButtonRef: RefObject<HTMLButtonElement | null>
  onToggleHelp: () => void
  onOpenLibrary: () => void
  isDirty: boolean
  themeMode: 'auto' | 'light' | 'dark'
  onThemeChange: (mode: 'auto' | 'light' | 'dark') => void
  disabled: boolean
}

export default function Toolbar({
  isEditing,
  onToggleEdit,
  onToggleShare,
  shareOpen,
  shareButtonRef,
  helpButtonRef,
  onToggleHelp,
  onOpenLibrary,
  isDirty,
  themeMode,
  onThemeChange,
  disabled,
}: ToolbarProps) {
  const { languagePreference, setLanguagePreference } = useI18n()

  const toolbarVisible = useScrollToolbar()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPage, setMenuPage] = useState<'main' | 'settings'>('main')
  const menu = useRef<HTMLDivElement>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menuOpen || menuPage !== 'settings') return
    backButton.current?.focus()
    return () => settingsButton.current?.focus()
  }, [menuOpen, menuPage])
  useEffect(() => {
    if (!menuOpen) return
    const outside = (event: Event) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setMenuOpen(false)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        helpButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen, helpButtonRef])

  return (
    <div className={`toolbar${toolbarVisible ? '' : ' toolbar-hidden'}`}>
      <div className="toolbar-left">
        <h1 className="logo">
          <a href={window.location.pathname} aria-label={t('common.home')}>
            <span className="brand-mark" aria-hidden="true" />
            <span>raw-md</span>
          </a>
        </h1>
      </div>
      <div className="toolbar-actions">
        {isEditing && isDirty && (
          <span className="toolbar-hint toolbar-hint-dirty" data-hint={t('toolbar.recopy')}>
            {t('toolbar.modified')}
          </span>
        )}
        <button
          type="button"
          className="btn"
          aria-label={t('common.link')}
          ref={shareButtonRef}
          onClick={() => {
            setMenuOpen(false)
            onToggleShare()
          }}
          disabled={disabled}
          aria-expanded={shareOpen}
          aria-controls={shareOpen ? 'share-popover' : undefined}
          aria-haspopup="dialog"
        >
          <Link2 size={16} />
          <span className="btn-label">{t('common.link')}</span>
        </button>
        <button
          type="button"
          className="btn"
          aria-label={isEditing ? t('common.view') : t('common.edit')}
          onClick={() => {
            setMenuOpen(false)
            onToggleEdit()
          }}
          disabled={disabled}
        >
          {isEditing ? <Eye size={16} /> : <Pencil size={16} />}
          <span className="btn-label">{isEditing ? t('common.view') : t('common.edit')}</span>
        </button>
        <div ref={menu} className="toolbar-menu">
          <button
            ref={helpButtonRef}
            type="button"
            className="btn btn-icon"
            aria-label={t('common.menu')}
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? 'app-menu' : undefined}
            onClick={() => {
              setMenuPage('main')
              setMenuOpen(!menuOpen)
            }}
          >
            <Menu size={18} />
          </button>
          {menuOpen && (
            <section id="app-menu" className="app-menu" aria-label={t('toolbar.menuLabel')}>
              {menuPage === 'main' ? (
                <>
                  <button
                    type="button"
                    className="app-menu-help"
                    aria-label={t('common.library')}
                    aria-keyshortcuts="Meta+K Control+K"
                    onClick={() => {
                      setMenuOpen(false)
                      onOpenLibrary()
                    }}
                  >
                    <FolderOpen size={16} />
                    {t('common.library')}
                    <kbd className="menu-shortcut">⌘K / Ctrl+K</kbd>
                  </button>
                  <button
                    type="button"
                    className="app-menu-help"
                    onClick={() => {
                      setMenuOpen(false)
                      onToggleHelp()
                    }}
                  >
                    <CircleHelp size={16} />
                    {t('common.help')}
                  </button>
                  <button
                    ref={settingsButton}
                    type="button"
                    className="app-menu-help"
                    onClick={() => setMenuPage('settings')}
                  >
                    <Settings size={16} />
                    {t('toolbar.settings')}
                    <ChevronRight size={14} className="menu-chevron" />
                  </button>
                  <a
                    className="app-menu-help"
                    href="https://github.com/hellojianijinworld/raw-md/blob/main/CONTRIBUTING.md"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GitPullRequest size={16} />
                    {t('toolbar.contribute')}
                  </a>
                </>
              ) : (
                <>
                  <button
                    ref={backButton}
                    type="button"
                    className="app-menu-help app-menu-back"
                    aria-label={t('toolbar.back')}
                    onClick={() => setMenuPage('main')}
                  >
                    <ArrowLeft size={16} />
                    {t('toolbar.settings')}
                  </button>
                  <fieldset>
                    <legend>{t('toolbar.theme')}</legend>
                    {(
                      [
                        ['auto', t('toolbar.system')],
                        ['light', t('toolbar.light')],
                        ['dark', t('toolbar.dark')],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="theme"
                          value={value}
                          checked={themeMode === value}
                          onChange={() => onThemeChange(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset>
                    <legend>{t('toolbar.language')}</legend>
                    {(
                      [
                        ['auto', t('toolbar.browserLanguage')],
                        ['ko', t('language.ko')],
                        ['en', t('language.en')],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="language"
                          value={value}
                          checked={languagePreference === value}
                          onChange={() => setLanguagePreference(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <div className="app-menu-version">
                    <a
                      href={import.meta.env.VITE_RELEASE_URL || 'https://github.com/hellojianijinworld/raw-md/releases'}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('toolbar.releaseHint')}
                    >
                      {import.meta.env.VITE_RELEASE_VERSION
                        ? t('toolbar.release', { version: import.meta.env.VITE_RELEASE_VERSION })
                        : t('toolbar.noRelease')}
                    </a>
                    {import.meta.env.VITE_BUILD_COMMIT && (
                      <a
                        href={`https://github.com/hellojianijinworld/raw-md/commit/${import.meta.env.VITE_BUILD_COMMIT}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('toolbar.build', { commit: import.meta.env.VITE_BUILD_COMMIT.slice(0, 7) })}
                      </a>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
