import { CircleHelp, Eye, Link2, Monitor, Moon, Pencil, Sun } from 'lucide-react'
import type { RefObject } from 'react'
import { useScrollToolbar } from '../hooks/useScrollToolbar'

export type CopyStatus = 'idle' | 'compressing' | 'copied' | 'error'

interface ToolbarProps {
  isEditing: boolean
  onToggleEdit: () => void
  onToggleShare: () => void
  shareOpen: boolean
  shareButtonRef: RefObject<HTMLButtonElement | null>
  helpButtonRef: RefObject<HTMLButtonElement | null>
  helpOpen: boolean
  onToggleHelp: () => void
  isDirty: boolean
  themeMode: 'auto' | 'light' | 'dark'
  onToggleTheme: () => void
  disabled: boolean
}

const themeIcons = {
  auto: Monitor,
  light: Sun,
  dark: Moon,
}

function GitHubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ display: 'block' }}
      aria-label="GitHub"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

export default function Toolbar({
  isEditing,
  onToggleEdit,
  onToggleShare,
  shareOpen,
  shareButtonRef,
  helpButtonRef,
  helpOpen,
  onToggleHelp,
  isDirty,
  themeMode,
  onToggleTheme,
  disabled,
}: ToolbarProps) {
  const toolbarVisible = useScrollToolbar()
  const ThemeIcon = themeIcons[themeMode]

  return (
    <div className={`toolbar${toolbarVisible ? '' : ' toolbar-hidden'}`}>
      <div className="toolbar-left">
        <h1 className="logo">
          <a href={window.location.pathname}>raw-md</a>
        </h1>
        <a
          href="https://github.com/hellojianijinworld/raw-md"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-icon btn-github"
          title="GitHub 저장소"
        >
          <GitHubIcon />
        </a>
      </div>
      <div className="toolbar-actions">
        <button
          type="button"
          className="btn"
          ref={helpButtonRef}
          aria-label="도움말"
          onClick={onToggleHelp}
          aria-expanded={helpOpen}
          aria-haspopup="dialog"
        >
          <CircleHelp size={16} />
          <span className="btn-label">도움말</span>
        </button>
        {isEditing && isDirty && <span className="toolbar-hint toolbar-hint-dirty">수정됨</span>}
        <button
          type="button"
          className="btn"
          ref={shareButtonRef}
          onClick={onToggleShare}
          disabled={disabled}
          aria-expanded={shareOpen}
          aria-controls={shareOpen ? 'share-popover' : undefined}
          aria-haspopup="dialog"
        >
          <Link2 size={16} />
          <span className="btn-label">링크</span>
        </button>
        <button type="button" className="btn" onClick={onToggleEdit} disabled={disabled}>
          {isEditing ? <Eye size={16} /> : <Pencil size={16} />}
          <span className="btn-label">{isEditing ? '뷰어' : '수정'}</span>
        </button>
        <button type="button" className="btn btn-icon" onClick={onToggleTheme} title={`테마: ${themeMode}`}>
          <ThemeIcon size={18} />
        </button>
      </div>
    </div>
  )
}
