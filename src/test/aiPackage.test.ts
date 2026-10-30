// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../', import.meta.url))
const archive = join(root, 'public/ai/raw-md-ai.zip')
const directory = mkdtempSync(join(tmpdir(), 'raw-md-package-'))
const extracted = join(directory, 'raw-md-ai')
let entries: string[]
let originalArchive: Buffer

function build() {
  return spawnSync(process.execPath, [join(root, 'scripts/package-ai.mjs')], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 30_000,
  })
}

function json(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

beforeAll(() => {
  const result = build()
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  originalArchive = readFileSync(archive)
  const extraction = spawnSync(
    'python3',
    [
      '-c',
      `import json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    assert archive.testzip() is None
    archive.extractall(sys.argv[2])
    print(json.dumps(archive.namelist()))`,
      archive,
      directory,
    ],
    { encoding: 'utf8', timeout: 30_000 },
  )
  expect(extraction.stderr).toBe('')
  expect(extraction.status).toBe(0)
  entries = JSON.parse(extraction.stdout)
})

afterAll(() => rmSync(directory, { recursive: true, force: true }))

it('builds a deterministic archive containing only the optional integration files', () => {
  expect(entries).toEqual([
    'raw-md-ai/.agents/plugins/marketplace.json',
    'raw-md-ai/.claude-plugin/marketplace.json',
    'raw-md-ai/INSTALL.md',
    'raw-md-ai/plugin/.claude-plugin/plugin.json',
    'raw-md-ai/plugin/plugin.json',
    'raw-md-ai/plugin/skills/raw-md-export/SKILL.md',
    'raw-md-ai/plugin/skills/raw-md-export/scripts/check-update.mjs',
    'raw-md-ai/plugin/skills/raw-md-export/scripts/share.mjs',
    'raw-md-ai/plugin/skills/raw-md-export/scripts/share.mjs.sha256',
    'raw-md-ai/plugin/skills/raw-md-export/version.json',
  ])
  expect(build().status).toBe(0)
  expect(readFileSync(archive)).toEqual(originalArchive)
  const sdk = readFileSync(join(extracted, 'plugin/skills/raw-md-export/scripts/share.mjs'))
  expect(json(join(root, 'public/ai/manifest.json'))).toMatchObject({
    version: '0.1.0',
    artifact: 'raw-md-ai.zip',
    sha256: createHash('sha256').update(originalArchive).digest('hex'),
    bytes: originalArchive.length,
    sdkSha256: createHash('sha256').update(sdk).digest('hex'),
    runtime: 'node >=22',
    cli: 'plugin/skills/raw-md-export/scripts/share.mjs',
  })
})

it('resolves both marketplaces to one plugin with the shared skill and exact offline SDK', () => {
  expect(readFileSync(join(root, 'public/ai/INSTALL.md'))).toEqual(readFileSync(join(extracted, 'INSTALL.md')))
  const codex = json(join(extracted, '.agents/plugins/marketplace.json'))
  const claude = json(join(extracted, '.claude-plugin/marketplace.json'))
  expect(codex.plugins).toHaveLength(1)
  expect(claude.plugins).toHaveLength(1)
  expect(codex.plugins[0].source.source).toBe('local')
  const codexPlugin = resolve(extracted, codex.plugins[0].source.path)
  const claudePlugin = resolve(extracted, claude.plugins[0].source)
  expect(codexPlugin).toBe(join(extracted, 'plugin'))
  expect(claudePlugin).toBe(codexPlugin)
  expect(json(join(codexPlugin, 'plugin.json'))).toMatchObject({
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name: 'raw-md-ai',
    version: '0.1.0',
  })
  expect(json(join(claudePlugin, '.claude-plugin/plugin.json'))).toMatchObject({
    name: 'raw-md-ai',
    version: '0.1.0',
  })
  for (const file of [
    'SKILL.md',
    'version.json',
    'scripts/share.mjs',
    'scripts/share.mjs.sha256',
    'scripts/check-update.mjs',
  ]) {
    expect(readFileSync(join(codexPlugin, 'skills/raw-md-export', file))).toEqual(
      readFileSync(join(root, 'skills/raw-md-export', file)),
    )
  }
  const sdk = readFileSync(join(codexPlugin, 'skills/raw-md-export/scripts/share.mjs'))
  expect(sdk).toEqual(readFileSync(join(root, 'public/codec/v2/share.mjs')))
  expect(readFileSync(join(codexPlugin, 'skills/raw-md-export/scripts/share.mjs.sha256'), 'utf8')).toBe(
    `${createHash('sha256').update(sdk).digest('hex')}  share.mjs\n`,
  )
})

it('keeps update records inside the extracted skill and out of the distributed archive', () => {
  const skill = join(extracted, 'plugin/skills/raw-md-export')
  expect(json(join(skill, 'version.json'))).toEqual({ version: '0.1.0' })
  const output = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `globalThis.fetch = async () => new Response(JSON.stringify({ version: '0.1.1' }));
const { checkForUpdates } = await import(${JSON.stringify(pathToFileURL(join(skill, 'scripts/check-update.mjs')).href)});
process.stdout.write(JSON.stringify(await checkForUpdates()));`,
    ],
    { cwd: directory, encoding: 'utf8', timeout: 10_000 },
  )
  expect(output.status).toBe(0)
  expect(JSON.parse(output.stdout).status).toBe('update-available')
  expect(json(join(skill, '.update-check.json')).installedVersion).toBe('0.1.0')
  expect(entries.some((entry) => entry.includes('.update-check'))).toBe(false)
  expect(build().status).toBe(0)
  expect(readFileSync(archive)).toEqual(originalArchive)
})

it('runs the extracted CLI from an unrelated directory without dependencies to read and export Markdown', () => {
  const script = join(extracted, 'plugin/skills/raw-md-export/scripts/share.mjs')
  const options = {
    cwd: directory,
    encoding: 'utf8' as const,
    env: { PATH: process.env.PATH, NODE_PATH: '' },
    timeout: 30_000,
  }
  const read = spawnSync(process.execPath, [script, '--decode'], {
    ...options,
    input: 'https://raw-md.pages.dev/#BYUwNmD2Q',
  })
  expect(read.status).toBe(0)
  expect(read.stderr).toBe('')
  expect(JSON.parse(read.stdout)).toMatchObject({ markdown: 'hello', sourceBytes: 5, encrypted: false })
  const write = spawnSync(process.execPath, [script, '--output', 'url'], { ...options, input: 'hello' })
  expect(write.status).toBe(0)
  expect(write.stderr).toBe('')
  expect(JSON.parse(write.stdout)).toEqual({
    formatVersion: 2,
    mode: 'plain',
    url: 'https://raw-md.pages.dev/#BYUwNmD2Q',
    urlLength: 35,
    sourceBytes: 5,
  })
})
