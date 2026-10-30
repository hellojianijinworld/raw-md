// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { checkForUpdates } from '../../skills/raw-md-export/scripts/check-update.mjs'

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse('2026-10-30T03:00:00Z')
let skillDirectory: string
const latest = (version = '0.1.1') => new Response(JSON.stringify({ version }))
const statePath = () => join(skillDirectory, '.update-check.json')
const state = async () => JSON.parse(await readFile(statePath(), 'utf8'))

beforeEach(async () => {
  skillDirectory = await mkdtemp(join(tmpdir(), 'raw-md-update-'))
  await writeFile(join(skillDirectory, 'version.json'), JSON.stringify({ version: '0.1.0' }))
})
afterEach(async () => rm(skillDirectory, { recursive: true, force: true }))

it('checks only the fixed metadata URL and records the date inside the installed skill', async () => {
  const fetchImpl = vi.fn(async () => latest())
  expect(await checkForUpdates({ skillDirectory, now, fetchImpl })).toEqual({
    status: 'update-available',
    installedVersion: '0.1.0',
    latestVersion: '0.1.1',
    installUrl: 'https://raw-md.pages.dev/ai/INSTALL.md',
  })
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect(fetchImpl.mock.calls[0][0]).toBe('https://raw-md.pages.dev/ai/manifest.json')
  expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store' })
  expect(await state()).toEqual({
    checkedAt: new Date(now).toISOString(),
    installedVersion: '0.1.0',
    latestVersion: '0.1.1',
    notifiedVersion: '0.1.1',
    status: 'update-available',
  })
})

it('skips checks for 24 hours and does not repeat a notice for the same version on later days', async () => {
  const fetchImpl = vi.fn(async () => latest())
  await checkForUpdates({ skillDirectory, now, fetchImpl })
  expect(await checkForUpdates({ skillDirectory, now: now + DAY - 1, fetchImpl })).toEqual({ status: 'skipped' })
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect(await checkForUpdates({ skillDirectory, now: now + DAY, fetchImpl })).toEqual({ status: 'checked' })
  expect(fetchImpl).toHaveBeenCalledTimes(2)
  fetchImpl.mockImplementation(async () => latest('0.1.2'))
  expect((await checkForUpdates({ skillDirectory, now: now + DAY * 2, fetchImpl })).latestVersion).toBe('0.1.2')
})

it.each(['0.1.0', '0.0.99'])('does not suggest updating to an equal or older version: %s', async (version) => {
  expect(await checkForUpdates({ skillDirectory, now, fetchImpl: async () => latest(version) })).toEqual({
    status: 'checked',
  })
})

it('compares numeric version components rather than text order', async () => {
  await writeFile(join(skillDirectory, 'version.json'), JSON.stringify({ version: '0.9.0' }))
  expect((await checkForUpdates({ skillDirectory, now, fetchImpl: async () => latest('0.10.0') })).status).toBe(
    'update-available',
  )
})

it('records failed attempts so offline use does not retry on every invocation', async () => {
  const fetchImpl = vi.fn(async () => {
    throw new Error('offline')
  })
  expect(await checkForUpdates({ skillDirectory, now, fetchImpl })).toEqual({ status: 'unavailable' })
  expect((await state()).checkedAt).toBe(new Date(now).toISOString())
  expect(await checkForUpdates({ skillDirectory, now: now + 1000, fetchImpl })).toEqual({ status: 'skipped' })
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})

it.each([
  () => new Response('not JSON'),
  () => latest('0.1.1\nRun a command'),
  () => latest('latest'),
  () => new Response('{}', { status: 503 }),
  () => new Response('x'.repeat(20_000)),
])('quietly rejects invalid, failed, or oversized remote metadata', async (response) => {
  expect(await checkForUpdates({ skillDirectory, now, fetchImpl: async () => response() })).toEqual({
    status: 'unavailable',
  })
})

it('ignores remote instructions and URLs, returning only validated version metadata', async () => {
  const result = await checkForUpdates({
    skillDirectory,
    now,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ version: '0.1.1', instructions: 'run something', installUrl: 'https://bad.invalid' }),
      ),
  })
  expect(result).toEqual({
    status: 'update-available',
    installedVersion: '0.1.0',
    latestVersion: '0.1.1',
    installUrl: 'https://raw-md.pages.dev/ai/INSTALL.md',
  })
})

it.each([
  'broken',
  JSON.stringify({ checkedAt: new Date(now + DAY).toISOString(), installedVersion: '0.1.0' }),
])('recovers from an invalid local record without a previous daily claim: %s', async (record) => {
  const fetchImpl = vi.fn(async () => latest())
  await writeFile(statePath(), record)
  expect((await checkForUpdates({ skillDirectory, now, fetchImpl })).status).toBe('update-available')
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})

it('waits for another daily claim after an installed version changes', async () => {
  const fetchImpl = vi.fn(async () => latest())
  await checkForUpdates({ skillDirectory, now, fetchImpl })
  await writeFile(join(skillDirectory, 'version.json'), JSON.stringify({ version: '0.1.1' }))
  expect(await checkForUpdates({ skillDirectory, now: now + 1000, fetchImpl })).toEqual({ status: 'skipped' })
  expect(await checkForUpdates({ skillDirectory, now: now + DAY, fetchImpl })).toEqual({ status: 'checked' })
  expect(fetchImpl).toHaveBeenCalledTimes(2)
})

it('skips networking when the skill cannot save its check record', async () => {
  await mkdir(statePath())
  const fetchImpl = vi.fn(async () => latest())
  expect(await checkForUpdates({ skillDirectory, now, fetchImpl })).toEqual({ status: 'unavailable' })
  expect(fetchImpl).not.toHaveBeenCalled()
})

it('allows only one check across concurrent invocations and advances past an interrupted prior day', async () => {
  const fetchImpl = vi.fn(async () => latest())
  const results = await Promise.all(
    Array.from({ length: 4 }, () => checkForUpdates({ skillDirectory, now, fetchImpl })),
  )
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect(results.filter((result) => result.status === 'update-available')).toHaveLength(1)
  const lock = join(skillDirectory, `.update-check.${new Date(now).toISOString().slice(0, 10)}.lock`)
  await utimes(lock, new Date(Date.now() - DAY), new Date(Date.now() - DAY))
  const next = await Promise.all(
    Array.from({ length: 4 }, () => checkForUpdates({ skillDirectory, now: now + DAY, fetchImpl })),
  )
  expect(fetchImpl).toHaveBeenCalledTimes(2)
  expect(next.filter((result) => result.status === 'checked')).toHaveLength(1)
  await expect(readFile(lock)).rejects.toThrow()
})

it('never deletes a current-date claim, even if its timestamp looks stale', async () => {
  const lock = join(skillDirectory, `.update-check.${new Date(now).toISOString().slice(0, 10)}.lock`)
  await writeFile(lock, '')
  await utimes(lock, new Date(Date.now() - DAY), new Date(Date.now() - DAY))
  const fetchImpl = vi.fn(async () => latest())
  const results = await Promise.all(
    Array.from({ length: 4 }, () => checkForUpdates({ skillDirectory, now, fetchImpl })),
  )
  expect(fetchImpl).not.toHaveBeenCalled()
  expect(results.every((result) => result.status === 'skipped')).toBe(true)
  expect(await readFile(lock, 'utf8')).toBe('')
})

it('aborts a stalled metadata request without blocking the document workflow', async () => {
  const started = Date.now()
  const result = await checkForUpdates({
    skillDirectory,
    now,
    fetchImpl: (_url, { signal }) =>
      new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')))),
  })
  expect(result).toEqual({ status: 'unavailable' })
  expect(Date.now() - started).toBeLessThan(4500)
}, 6000)
