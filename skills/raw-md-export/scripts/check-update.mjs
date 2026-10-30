import { realpathSync } from 'node:fs'
import { open, readdir, readFile, rename, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 3000
const DAILY_CLAIM_PATTERN = /^\.update-check\.(\d{4}-\d{2}-\d{2})\.lock$/
const MAX_METADATA_BYTES = 16 * 1024
const VERSION_PATTERN = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/
const MANIFEST_URL = 'https://raw-md.pages.dev/ai/manifest.json'
const INSTALL_URL = 'https://raw-md.pages.dev/ai/INSTALL.md'

function validVersion(value) {
  return typeof value === 'string' && VERSION_PATTERN.test(value)
}

function newerVersion(candidate, installed) {
  const current = installed.split('.').map(Number)
  for (const [index, value] of candidate.split('.').map(Number).entries()) {
    if (value !== current[index]) return value > current[index]
  }
  return false
}

async function readJson(path) {
  try {
    if ((await stat(path)).size > MAX_METADATA_BYTES) return undefined
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return undefined
  }
}

async function writeRecord(path, record) {
  const temporary = `${path}.${process.pid}.tmp`
  try {
    const file = await open(temporary, 'wx', 0o600)
    try {
      await file.writeFile(`${JSON.stringify(record, null, 2)}\n`)
    } finally {
      await file.close()
    }
    await rename(temporary, path)
  } finally {
    await unlink(temporary).catch(() => {})
  }
}

async function remoteVersion(fetchImpl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetchImpl(MANIFEST_URL, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok || !response.body) throw new Error('Unavailable metadata')
    const chunks = []
    let length = 0
    for await (const chunk of response.body) {
      length += chunk.byteLength
      if (length > MAX_METADATA_BYTES) throw new Error('Oversized metadata')
      chunks.push(chunk)
    }
    const value = JSON.parse(Buffer.concat(chunks, length).toString('utf8'))?.version
    if (!validVersion(value)) throw new Error('Invalid version')
    return value
  } finally {
    clearTimeout(timer)
  }
}

// This helper only checks metadata; document conversion remains offline in share.mjs.
export async function checkForUpdates({
  skillDirectory = fileURLToPath(new URL('../', import.meta.url)),
  now = Date.now(),
  fetchImpl = globalThis.fetch,
} = {}) {
  const recordPath = join(skillDirectory, '.update-check.json')
  let lock
  try {
    const installedVersion = (await readJson(join(skillDirectory, 'version.json')))?.version
    if (!validVersion(installedVersion)) return { status: 'unavailable' }
    const previous = await readJson(recordPath)
    const age = now - Date.parse(previous?.checkedAt)
    if (previous?.installedVersion === installedVersion && age >= 0 && age < CHECK_INTERVAL_MS)
      return { status: 'skipped' }
    const date = new Date(now).toISOString().slice(0, 10)
    try {
      // Keep today's claim even after a crash; never reclaim another invocation's live lock.
      lock = await open(join(skillDirectory, `.update-check.${date}.lock`), 'wx', 0o600)
    } catch (error) {
      return { status: error.code === 'EEXIST' ? 'skipped' : 'unavailable' }
    }
    for (const name of await readdir(skillDirectory).catch(() => [])) {
      const claimDate = name.match(DAILY_CLAIM_PATTERN)?.[1]
      if (claimDate && claimDate < date) await unlink(join(skillDirectory, name)).catch(() => {})
    }
    const record = {
      checkedAt: new Date(now).toISOString(),
      installedVersion,
      ...(validVersion(previous?.latestVersion) ? { latestVersion: previous.latestVersion } : {}),
      ...(validVersion(previous?.notifiedVersion) ? { notifiedVersion: previous.notifiedVersion } : {}),
      status: 'unavailable',
    }
    // Claim the attempt before networking, including failures and process interruption.
    await writeRecord(recordPath, record)
    try {
      record.latestVersion = await remoteVersion(fetchImpl)
      const newer = newerVersion(record.latestVersion, installedVersion)
      record.status = newer ? 'update-available' : 'current'
      const notify = newer && record.notifiedVersion !== record.latestVersion
      if (notify) record.notifiedVersion = record.latestVersion
      await writeRecord(recordPath, record)
      return notify
        ? { status: 'update-available', installedVersion, latestVersion: record.latestVersion, installUrl: INSTALL_URL }
        : { status: 'checked' }
    } catch {
      return { status: 'unavailable' }
    }
  } catch {
    return { status: 'unavailable' }
  } finally {
    if (lock) await lock.close().catch(() => {})
  }
}

function isEntryPoint() {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isEntryPoint()) process.stdout.write(`${JSON.stringify(await checkForUpdates())}\n`)
