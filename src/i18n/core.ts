import { en, ko, type MessageKey } from './messages'

export type Locale = 'ko' | 'en'
export type LanguagePreference = 'auto' | Locale
export const LANGUAGE_STORAGE_KEY = 'raw-md-language'
const listeners = new Set<() => void>()
let preference: LanguagePreference = readPreference()
let runtimeLocale: Locale | undefined

function readPreference(): LanguagePreference {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return stored === 'ko' || stored === 'en' ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

export function selectBrowserLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    if (typeof language !== 'string') continue
    const base = language.toLowerCase().split(/[-_]/)[0]
    if (base === 'ko' || base === 'en') return base
  }
  return 'en'
}

export function getLocale(): Locale {
  if (runtimeLocale) return runtimeLocale
  if (preference !== 'auto') return preference
  if (typeof navigator === 'undefined') return 'en'
  return selectBrowserLocale(navigator.languages?.length ? navigator.languages : [navigator.language])
}

export function getLanguagePreference(): LanguagePreference {
  return preference
}
export function getLanguageSnapshot(): string {
  return `${preference}:${getLocale()}`
}

function notify(): void {
  for (const listener of listeners) listener()
}

export function setLanguagePreference(value: LanguagePreference): void {
  preference = value
  runtimeLocale = undefined
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, value)
  } catch {
    /* The selection still works for this session. */
  }
  notify()
}

// Workers receive the selected language with the task; they cannot read localStorage.
export function setRuntimeLocale(value?: Locale): void {
  runtimeLocale = value
}

function storageChanged(event: StorageEvent): void {
  if (event.key !== LANGUAGE_STORAGE_KEY && event.key !== null) return
  preference = readPreference()
  notify()
}

export function subscribeLanguage(listener: () => void): () => void {
  if (!listeners.size && typeof window !== 'undefined') {
    window.addEventListener('storage', storageChanged)
    window.addEventListener('languagechange', notify)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size && typeof window !== 'undefined') {
      window.removeEventListener('storage', storageChanged)
      window.removeEventListener('languagechange', notify)
    }
  }
}

export function translate(key: MessageKey, values: Record<string, string | number> = {}): string {
  const message: string = (getLocale() === 'ko' ? ko : en)[key]
  return message.replace(/\{(\w+)\}/g, (token, name: string) => String(values[name] ?? token))
}

const messageKeys = new Map<string, MessageKey>()
for (const key of Object.keys(ko) as MessageKey[]) {
  messageKeys.set(ko[key], key)
  messageKeys.set(en[key], key)
}

// Messages may have been created before a language change, including worker errors.
export function localizeMessage(message: string): string {
  const key = messageKeys.get(message)
  return key ? translate(key) : message
}

export function localizedError(error: unknown, fallback: MessageKey): string {
  const key = error instanceof Error ? messageKeys.get(error.message) : undefined
  return translate(key ?? fallback)
}
