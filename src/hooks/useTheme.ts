import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
type ColorMode = 'auto' | 'light' | 'dark'

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode: ColorMode): Theme {
  const resolved = mode === 'auto' ? getSystemTheme() : mode
  // Primer Primitives
  document.documentElement.setAttribute('data-color-mode', resolved)
  document.documentElement.setAttribute('data-light-theme', 'light')
  document.documentElement.setAttribute('data-dark-theme', 'dark')
  // github-markdown-css
  document.documentElement.setAttribute('data-theme', resolved)
  return resolved
}

export function useTheme(): {
  theme: Theme
  mode: ColorMode
  toggleTheme: () => void
  setThemeMode: (mode: ColorMode) => void
} {
  const [mode, setMode] = useState<ColorMode>(() => {
    const saved = localStorage.getItem('raw-md-color-mode') as ColorMode | null
    return saved === 'light' || saved === 'dark' ? saved : 'auto'
  })

  const [theme, setTheme] = useState<Theme>(() => applyTheme(mode))

  useEffect(() => {
    const resolved = applyTheme(mode)
    setTheme(resolved)
    localStorage.setItem('raw-md-color-mode', mode)
  }, [mode])

  useEffect(() => {
    if (mode !== 'auto') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const resolved = applyTheme('auto')
      setTheme(resolved)
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [mode])

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next: ColorMode = prev === 'auto' ? 'light' : prev === 'light' ? 'dark' : 'auto'
      return next
    })
  }, [])

  return { theme, mode, toggleTheme, setThemeMode: setMode }
}
