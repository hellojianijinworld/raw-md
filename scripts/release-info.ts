export const releasesUrl = 'https://github.com/hellojianijinworld/raw-md/releases'

export async function getReleaseInfo(fetcher: typeof fetch = fetch) {
  try {
    const response = await fetcher('https://api.github.com/repos/hellojianijinworld/raw-md/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(5000),
    })
    if (response.status === 404) return { version: '', url: releasesUrl }
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
    const release = await response.json()
    if (
      !release ||
      typeof release !== 'object' ||
      !('tag_name' in release) ||
      typeof release.tag_name !== 'string' ||
      !release.tag_name.trim() ||
      release.tag_name.length > 100
    ) {
      throw new Error('Invalid release tag')
    }
    return { version: release.tag_name, url: `${releasesUrl}/tag/${encodeURIComponent(release.tag_name)}` }
  } catch {
    console.warn('Release metadata unavailable; using the build commit instead.')
    return { version: '', url: releasesUrl }
  }
}
