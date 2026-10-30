import { afterEach, expect, it, vi } from 'vitest'
import { getLocale, localizeMessage, selectBrowserLocale, setLanguagePreference, translate } from '../i18n/core'
import { en, ko } from '../i18n/messages'

afterEach(() => {
  vi.unstubAllGlobals()
  setLanguagePreference('ko')
})

it('matches browser preferences and falls back to English for unsupported languages', () => {
  expect(selectBrowserLocale(['ko-KR', 'en-US'])).toBe('ko')
  expect(selectBrowserLocale(['fr-FR', 'en-GB', 'ko'])).toBe('en')
  expect(selectBrowserLocale(['ja-JP', 'ko-KR'])).toBe('ko')
  expect(selectBrowserLocale(['fr-FR'])).toBe('en')
})

it('uses an explicit preference and interpolates user text without translating it', () => {
  vi.stubGlobal('navigator', { languages: ['ko-KR'], language: 'ko-KR' })
  setLanguagePreference('auto')
  expect(getLocale()).toBe('ko')
  setLanguagePreference('en')
  expect(getLocale()).toBe('en')
  expect(translate('library.download', { title: '한글 문서' })).toBe('Download 한글 문서')
  expect(localizeMessage(ko['error.unlock'])).toBe(en['error.unlock'])
})

it('keeps all translation keys and interpolation parameters in sync', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(ko).sort())
  for (const key of Object.keys(ko) as (keyof typeof ko)[]) {
    expect(en[key].trim()).not.toBe('')
    expect(en[key].match(/\{\w+\}/g)?.sort()).toEqual(ko[key].match(/\{\w+\}/g)?.sort())
  }
})
