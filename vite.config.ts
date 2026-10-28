import { execFileSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig, type ViteUserConfig } from 'vitest/config'
import { getReleaseInfo, releasesUrl } from './scripts/release-info'

// https://vite.dev/config/
export default defineConfig(async ({ command }): Promise<ViteUserConfig> => {
  const release = command === 'build' ? await getReleaseInfo() : { version: '', url: releasesUrl }
  const commit =
    process.env.CF_PAGES_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  return {
    plugins: [react()],
    test: { setupFiles: ['./src/test/setupLocale.ts'] },
    base: '/',
    worker: { format: 'es' },
    define: {
      'import.meta.env.VITE_RELEASE_VERSION': JSON.stringify(release.version),
      'import.meta.env.VITE_RELEASE_URL': JSON.stringify(release.url),
      'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(commit),
    },
  }
})
