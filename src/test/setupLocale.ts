import { beforeEach } from 'vitest'
import { setLanguagePreference } from '../i18n/core'

// Existing behavior tests use Korean explicitly; locale tests exercise browser detection separately.
beforeEach(() => setLanguagePreference('ko'))
