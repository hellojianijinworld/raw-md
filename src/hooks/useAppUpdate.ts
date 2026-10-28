import { useEffect, useState } from 'react'

export const APP_UPDATE_INTERVAL_MS = 60_000
const CHECK_TIMEOUT_MS = 10_000
interface Deployment {
  version: string
  commit: string
}

export function useAppUpdate() {
  const [latest, setLatest] = useState<Deployment | null>(null)
  const [dismissed, setDismissed] = useState('')
  useEffect(() => {
    if (!import.meta.env.PROD) return
    let stopped = false
    let active: AbortController | undefined
    const check = async () => {
      if (document.visibilityState === 'hidden' || active) return
      const controller = new AbortController()
      active = controller
      const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
      try {
        const response = await fetch('/version.json', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const data: unknown = await response.json()
        if (
          !data ||
          typeof data !== 'object' ||
          !('version' in data) ||
          typeof data.version !== 'string' ||
          !/^v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(data.version) ||
          data.version.length > 100 ||
          !('commit' in data) ||
          typeof data.commit !== 'string' ||
          !/^[a-f\d]{40}$/.test(data.commit)
        )
          return
        if (!stopped)
          setLatest(
            data.commit === import.meta.env.VITE_BUILD_COMMIT && data.version === import.meta.env.VITE_APP_VERSION
              ? null
              : { version: data.version, commit: data.commit },
          )
      } catch {
        // Version checks must never interrupt reading or editing, including when offline.
      } finally {
        clearTimeout(timeout)
        active = undefined
      }
    }
    void check()
    const timer = setInterval(check, APP_UPDATE_INTERVAL_MS)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      stopped = true
      active?.abort()
      clearInterval(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  const key = latest ? `${latest.commit}:${latest.version}` : ''
  return { update: key && key !== dismissed ? latest : null, dismiss: () => setDismissed(key) }
}
