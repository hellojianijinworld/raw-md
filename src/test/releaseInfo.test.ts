import { expect, it, vi } from 'vitest'
import { getReleaseInfo, releasesUrl } from '../../scripts/release-info'

it('uses the latest GitHub release tag and a fixed repository link', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ tag_name: 'v1.2.3', html_url: 'https://untrusted.example' })))
  expect(await getReleaseInfo(fetcher)).toEqual({ version: 'v1.2.3', url: `${releasesUrl}/tag/v1.2.3` })
  expect(fetcher.mock.calls[0][0]).toBe('https://api.github.com/repos/hellojianijinworld/raw-md/releases/latest')
})

it.each([404, 403, 500])('keeps builds available when GitHub returns %s', async (status) => {
  expect(await getReleaseInfo(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status })))).toEqual({
    version: '',
    url: releasesUrl,
  })
})

it('handles offline builds and malformed release responses', async () => {
  expect(await getReleaseInfo(vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')))).toEqual({
    version: '',
    url: releasesUrl,
  })
  expect(await getReleaseInfo(vi.fn<typeof fetch>().mockResolvedValue(new Response('{"tag_name":null}')))).toEqual({
    version: '',
    url: releasesUrl,
  })
})
