import { CircleHelp, Eye, FolderOpen, GitPullRequest, Link2, Menu, Pencil } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { useScrollToolbar } from '../hooks/useScrollToolbar'

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
  const toolbarVisible = useScrollToolbar()
  const [menuOpen, setMenuOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
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
          <a href={window.location.pathname} aria-label="raw-md 홈">
            <span className="brand-mark" aria-hidden="true" />
            <span>raw-md</span>
          </a>
        </h1>
      </div>
      <div className="toolbar-actions">
        {isEditing && isDirty && <span className="toolbar-hint toolbar-hint-dirty">수정됨</span>}
        <button
          type="button"
          className="btn"
          aria-label="링크"
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
          <span className="btn-label">링크</span>
        </button>
        <button
          type="button"
          className="btn"
          aria-label={isEditing ? '뷰어' : '수정'}
          onClick={() => {
            setMenuOpen(false)
            onToggleEdit()
          }}
          disabled={disabled}
        >
          {isEditing ? <Eye size={16} /> : <Pencil size={16} />}
          <span className="btn-label">{isEditing ? '뷰어' : '수정'}</span>
        </button>
        <div ref={menu} className="toolbar-menu">
          <button
            ref={helpButtonRef}
            type="button"
            className="btn btn-icon"
            aria-label="메뉴"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? 'app-menu' : undefined}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu size={18} />
          </button>
          {menuOpen && (
            <section id="app-menu" className="app-menu" aria-label="도움말 및 설정">
              <button
                type="button"
                className="app-menu-help"
                aria-label="내 문서함"
                aria-keyshortcuts="Meta+K Control+K"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenLibrary()
                }}
              >
                <FolderOpen size={16} />내 문서함
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
                도움말
              </button>
              <a
                className="app-menu-help"
                href="https://github.com/hellojianijinworld/raw-md/blob/main/CONTRIBUTING.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitPullRequest size={16} />
                GitHub에서 기여하기
              </a>
              <fieldset>
                <legend>설정 · 화면 테마</legend>
                {(
                  [
                    ['auto', '시스템 설정'],
                    ['light', '라이트'],
                    ['dark', '다크'],
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
              <div className="app-menu-version">
                <a
                  href={import.meta.env.VITE_RELEASE_URL || 'https://github.com/hellojianijinworld/raw-md/releases'}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="배포 시점의 최신 GitHub 정식 릴리즈"
                >
                  {import.meta.env.VITE_RELEASE_VERSION
                    ? `기준 릴리즈 ${import.meta.env.VITE_RELEASE_VERSION}`
                    : '등록된 릴리즈 없음'}
                </a>
                {import.meta.env.VITE_BUILD_COMMIT && (
                  <a
                    href={`https://github.com/hellojianijinworld/raw-md/commit/${import.meta.env.VITE_BUILD_COMMIT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    빌드 {import.meta.env.VITE_BUILD_COMMIT.slice(0, 7)}
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
