import { useSyncExternalStore } from 'react'
import {
  getLanguagePreference,
  getLanguageSnapshot,
  getLocale,
  setLanguagePreference,
  subscribeLanguage,
  translate,
} from './core'

export function useI18n() {
  useSyncExternalStore(subscribeLanguage, getLanguageSnapshot, getLanguageSnapshot)
  return { t: translate, locale: getLocale(), languagePreference: getLanguagePreference(), setLanguagePreference }
}
