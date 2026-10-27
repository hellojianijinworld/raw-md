// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import initBrotli, * as brotli from '../../node_modules/brotli-wasm/pkg.web/brotli_wasm.js'
import { decryptMarkdown } from '../utils/encryption'
import { decodeMarkdown } from '../utils/urlCodec'

const artifact = new URL('../../public/codec/v2/share.mjs', import.meta.url)
const source = '\ufeff# exact 원문 😀\r\n  줄 앞과 뒤 공백  \n\t값\0\n'.repeat(80)
let directory: string
let standalone: string

beforeAll(async () => {
  await initBrotli(readFileSync(new URL('../../node_modules/brotli-wasm/pkg.web/brotli_wasm_bg.wasm', import.meta.url)))
})

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'raw-md-agent-'))
  standalone = join(directory, 'renamed-share.mjs')
  copyFileSync(artifact, standalone)
})
afterEach(() => rmSync(directory, { recursive: true, force: true }))

function cli(args: string[] = [], input: string | Buffer = source) {
  return spawnSync(process.execPath, [standalone, ...args], {
    cwd: directory,
    input,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, NODE_PATH: '' },
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
  })
}

function api(markdown: string, options?: unknown, action = 'createShareLink') {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `globalThis.fetch = () => { throw new Error('Network access is forbidden') };
const sdk = await import(${JSON.stringify(pathToFileURL(standalone).href)});
let input = ''; for await (const chunk of process.stdin) input += chunk;
const { markdown, options, action } = JSON.parse(input);
try { process.stdout.write(JSON.stringify(await sdk[action](markdown, options))); }
catch { process.stderr.write('rejected'); process.exitCode = 1; }`,
    ],
    { cwd: directory, input: JSON.stringify({ markdown, options, action }), encoding: 'utf8', timeout: 30_000 },
  )
}

it('runs a copied single file offline without node_modules and preserves the hello golden fragment', () => {
  const result = cli([], 'hello')
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  expect(JSON.parse(result.stdout)).toEqual({
    formatVersion: 2,
    mode: 'plain',
    url: 'https://raw-md.pages.dev/#BYUwNmD2Q',
    sourceBytes: 5,
    urlLength: 35,
  })
  expect(readdirSync(directory)).toEqual(['renamed-share.mjs'])
})

it('lets callers import a renamed copy without executing the CLI and uses browser-decodable native Brotli', () => {
  const result = api(source, { baseUrl: 'https://example.org/view/' })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  const share = JSON.parse(result.stdout)
  expect(share.url.split('#')[1]).toMatch(/^[bj]1\./)
  expect(decodeMarkdown(share.url.split('#')[1], brotli)).toBe(source)
  expect(share.url).toMatch(/^https:\/\/example\.org\/view\/#/)
  expect(share.sourceBytes).toBe(Buffer.byteLength(source))
  expect(share.urlLength).toBe(share.url.length)
  expect(share.password).toBeUndefined()
})

it('reads a UTF-8 file exactly, including BOM, CRLF, NUL, and final spaces', () => {
  writeFileSync(join(directory, 'input.md'), source)
  const result = cli(['--input', 'input.md'], 'unused stdin')
  expect(result.status).toBe(0)
  expect(decodeMarkdown(JSON.parse(result.stdout).url.split('#')[1], brotli)).toBe(source)
})

it('encrypts custom passwords from exact files without echoing the password', async () => {
  const password = '  exact 비밀번호 🔑  '
  writeFileSync(join(directory, 'password.txt'), password)
  const result = cli(['--mode', 'custom', '--password-file', 'password.txt'])
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  const share = JSON.parse(result.stdout)
  expect(share.mode).toBe('custom')
  expect(share.url.split('#')[1]).toMatch(/^e1\./)
  expect(await decryptMarkdown(share.url.split('#')[1], brotli, password)).toBe(source)
  expect(share).not.toHaveProperty('password')
  expect(result.stdout + result.stderr).not.toContain(password)
}, 15_000)

it('generates a secure password returned separately from a decryptable URL', async () => {
  const result = cli(['--mode', 'secure'])
  expect(result.status).toBe(0)
  const share = JSON.parse(result.stdout)
  expect(share.mode).toBe('secure')
  expect(share.password).toMatch(/^[\w-]{22}$/)
  expect(share.url).not.toContain(share.password)
  expect(share).not.toHaveProperty('fragment')
  expect(await decryptMarkdown(share.url.split('#')[1], brotli, share.password)).toBe(source)
}, 15_000)

it.each([
  { output: null },
  { mode: 'unknown' },
  { mode: null },
  { mode: 'custom' },
  { mode: 'custom', password: '' },
  { mode: 'custom', password: 'secret\n' },
  { mode: 'custom', password: 'secret\r' },
  { mode: 'plain', password: 'secret' },
  { mode: 'secure', password: 'secret' },
  { baseUrl: '/relative' },
  { baseUrl: 'http://example.org/' },
  { baseUrl: 'http://127.attacker.example/' },
  { baseUrl: 'https://user:secret@example.org/' },
  { baseUrl: 'https://example.org/?query=secret' },
  { baseUrl: 'https://example.org/#secret' },
])('rejects unsupported API options without downgrading to plain links: %j', (options) => {
  const result = api('synthetic confidential source', options)
  expect(result.status).toBe(1)
  expect(result.stdout).toBe('')
  expect(result.stderr).toBe('rejected')
})

it.each([
  'http://localhost:5173/',
  'http://127.0.0.1:5173/view/',
  'http://[::1]:5173/',
])('allows HTTP loopback base URLs: %s', (baseUrl) => {
  const result = api('hello', { baseUrl })
  expect(result.status).toBe(0)
  expect(JSON.parse(result.stdout).url).toBe(`${baseUrl}#BYUwNmD2Q`)
})

it.each(
  [
    ['--mode', 'unknown'],
    ['--mode', 'custom'],
    ['--password', 'synthetic-password-secret'],
    ['--mode', 'secure', '--password-file', 'missing-secret-password.txt'],
    ['--input', 'missing-secret-document.md'],
    ['--input'],
  ].map((args) => [args]),
)('fails CLI option errors without emitting links or source/password/path details: %j', (args) => {
  const result = cli(args, 'synthetic-document-secret')
  expect(result.status).toBe(1)
  expect(result.stdout).toBe('')
  expect(result.stderr).not.toMatch(/synthetic|missing-secret/)
  expect(result.stderr.length).toBeGreaterThan(0)
})

it('allows SDK imports from stdin scripts with no filesystem entry point', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-'], {
    cwd: directory,
    input: `const {createShareLink} = await import(${JSON.stringify(pathToFileURL(standalone).href)});
process.stdout.write(JSON.stringify(await createShareLink('hello')));`,
    encoding: 'utf8',
  })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  expect(JSON.parse(result.stdout).url).toBe('https://raw-md.pages.dev/#BYUwNmD2Q')
})

it.each([
  'secret\n',
  'secret\r\n',
  '',
  'a'.repeat(4097),
])('rejects empty, multiline, and oversized custom password files (%#)', (password) => {
  writeFileSync(join(directory, 'password.txt'), password)
  const result = cli(['--mode', 'custom', '--password-file', 'password.txt'])
  expect(result.status).toBe(1)
  expect(result.stdout).toBe('')
  expect(result.stderr).not.toContain('secret')
})

it('rejects invalid UTF-8 in documents and password files', () => {
  const document = cli([], Buffer.from([0xc0, 0xaf]))
  expect(document.status).toBe(1)
  expect(document.stdout).toBe('')
  writeFileSync(join(directory, 'password.txt'), Buffer.from([0xff]))
  const password = cli(['--mode', 'custom', '--password-file', 'password.txt'])
  expect(password.status).toBe(1)
  expect(password.stdout).toBe('')
})

it('rejects documents above the 4 MiB UTF-8 limit for stdin, files, and the API', () => {
  const oversized = Buffer.alloc(4 * 1024 * 1024 + 1, 0x61)
  writeFileSync(join(directory, 'large.md'), oversized)
  for (const result of [cli([], oversized), cli(['--input', 'large.md']), api(oversized.toString())]) {
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
  }
})

it('documents stdin, password-file, modes, and base URL in standalone help', () => {
  const result = cli(['--help'], '')
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  expect(result.stdout).toMatch(/--input.+stdin/s)
  expect(result.stdout).toContain('--password-file')
  expect(result.stdout).toMatch(/plain.+custom.+secure/s)
  expect(result.stdout).toContain('--base-url')
  expect(result.stdout).toContain('--decode')
  expect(result.stdout).toContain('--output')
})

it('ships identical offline and web snapshots with matching checksum and manifest', () => {
  const bytes = readFileSync(artifact)
  const digest = createHash('sha256').update(bytes).digest('hex')
  expect(readFileSync(new URL('../../skills/raw-md-export/scripts/share.mjs', import.meta.url))).toEqual(bytes)
  expect(readFileSync(new URL('../../public/codec/v2/share.mjs.sha256', import.meta.url), 'utf8')).toBe(
    `${digest}  share.mjs\n`,
  )
  expect(readFileSync(new URL('../../skills/raw-md-export/scripts/share.mjs.sha256', import.meta.url), 'utf8')).toBe(
    `${digest}  share.mjs\n`,
  )
  expect(
    JSON.parse(readFileSync(new URL('../../public/codec/v2/manifest.json', import.meta.url), 'utf8')),
  ).toMatchObject({
    formatVersion: 2,
    artifact: 'share.mjs',
    sha256: digest,
    bytes: bytes.length,
    runtime: 'node >=22',
    sdkExports: ['createShareLink', 'readShareLink'],
  })
})

it('emits only the requested opaque value in SDK and CLI output', () => {
  for (const result of [api('hello', { output: 'fragment' }), cli(['--output', 'fragment'], 'hello')]) {
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({
      formatVersion: 2,
      mode: 'plain',
      fragment: 'BYUwNmD2Q',
      sourceBytes: 5,
    })
  }
  const share = JSON.parse(api('hello').stdout)
  expect(share).not.toHaveProperty('fragment')
  expect(api('hello', { output: 'unknown' }).status).toBe(1)
})

it.each([
  'BYUwNmD2Q',
  '#BYUwNmD2Q',
  'https://offline.invalid/path?query=ignored#BYUwNmD2Q',
  'http://offline.invalid/#BYUwNmD2Q',
])('reads URL or fragment locally without fetching its origin: %s', (input) => {
  const result = api(input, undefined, 'readShareLink')
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  expect(JSON.parse(result.stdout)).toEqual({ formatVersion: 2, markdown: 'hello', sourceBytes: 5, encrypted: false })
})

it('decodes framed and legacy content with exact BOM, CRLF, NUL, and emoji', () => {
  const encoded = JSON.parse(api(source).stdout)
  for (const input of [encoded.url, encoded.url.split('#')[1], 'b1.BQAAAKssn08LAoBoZWxsbwM']) {
    const result = cli(['--decode'], input)
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({
      formatVersion: 2,
      markdown: input === 'b1.BQAAAKssn08LAoBoZWxsbwM' ? 'hello' : source,
      sourceBytes: input === 'b1.BQAAAKssn08LAoBoZWxsbwM' ? 5 : Buffer.byteLength(source),
      encrypted: false,
    })
  }
})

it('reads an independently encrypted legacy e1 fixture with exact password files', () => {
  const fixture = 'e1.AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaG5-qouGbwXzgcgTwpBZwFDipFBslqPDljNw'
  writeFileSync(join(directory, 'password.txt'), 'compatibility password 🔑')
  writeFileSync(join(directory, 'link.txt'), `https://offline.invalid/#${fixture}\n`)
  const result = cli(['--decode', '--input', 'link.txt', '--password-file', 'password.txt'], '')
  expect(result.status).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({ formatVersion: 2, markdown: 'hello', sourceBytes: 5, encrypted: true })
  for (const password of [undefined, 'wrong', 'compatibility password 🔑\n', 'a'.repeat(4097)]) {
    const rejected = api(fixture, { password }, 'readShareLink')
    expect(rejected.status).toBe(1)
    expect(rejected.stdout).toBe('')
  }
}, 15_000)

it.each([
  { mode: 'custom', password: '  exact 비밀번호 🔑  ' },
  { mode: 'secure', output: 'fragment' },
])('round trips encrypted links through the offline reader: $mode', (options) => {
  const share = JSON.parse(api(source, options).stdout)
  expect(share).not.toHaveProperty(options.mode === 'secure' ? 'url' : 'fragment')
  const read = api(share.url ?? share.fragment, { password: share.password ?? options.password }, 'readShareLink')
  expect(read.status).toBe(0)
  expect(JSON.parse(read.stdout)).toEqual({
    formatVersion: 2,
    markdown: source,
    sourceBytes: Buffer.byteLength(source),
    encrypted: true,
  })
}, 15_000)

it.each([
  ['--decode', '--mode', 'secure'],
  ['--decode', '--mode', 'plain'],
  ['--decode', '--output', 'url'],
  ['--decode', '--base-url', 'https://example.org/'],
  ['--output', 'unknown'],
])('rejects incompatible encode/decode options: %j', (...args) => {
  const result = cli(args, 'BYUwNmD2Q')
  expect(result.status).toBe(1)
  expect(result.stdout).toBe('')
})

it.each([
  'https://offline.invalid/',
  'ftp://offline.invalid/#BYUwNmD2Q',
  '#Qgarbage',
  'b1.BQAAAKssn08LAoBoZWxsbw',
  'BYUwNmD2Qextra',
  'e1.AA',
  'x'.repeat(12 * 1024 * 1024 + 1),
])('rejects malformed, missing, truncated, and oversized fragments (%#)', (input) => {
  const result = api(input, undefined, 'readShareLink')
  expect(result.status).toBe(1)
  expect(result.stdout).toBe('')
  expect(result.stderr).toBe('rejected')
})

it('keeps the frozen v1 artifact byte-identical while publishing v2', () => {
  expect(
    createHash('sha256')
      .update(readFileSync(new URL('../../public/codec/v1/share.mjs', import.meta.url)))
      .digest('hex'),
  ).toBe('3fc880ba7b471a078f9dad2e97bab60e7c4feb3d3c9c62a1060a393d65080df6')
})

it('rejects invalid decode password files and malformed UTF-8 links without echoing secrets', () => {
  const fixture = 'e1.AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaG5-qouGbwXzgcgTwpBZwFDipFBslqPDljNw'
  for (const password of ['secret\n', 'secret\r\n', '', 'a'.repeat(4097), Buffer.from([0xff])]) {
    writeFileSync(join(directory, 'password.txt'), password)
    const result = cli(['--decode', '--password-file', 'password.txt'], fixture)
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).not.toMatch(/secret|password\.txt|e1\./)
  }
  expect(cli(['--decode'], Buffer.from([0xc0, 0xaf])).status).toBe(1)
})

it('rejects trailing Brotli bytes and expansion beyond a forged frame length', () => {
  const hello = Buffer.from('BQAAAKssn08LAoBoZWxsbwM', 'base64url')
  const trailing = `b1.${Buffer.concat([hello, Buffer.from([0])]).toString('base64url')}`
  const forged = Buffer.from(hello)
  forged.writeUInt32LE(1, 0)
  for (const fragment of [trailing, `b1.${forged.toString('base64url')}`]) {
    const result = api(fragment, undefined, 'readShareLink')
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
  }
})

it('bounds legacy expansion and rejects passwords or encode options on plain reads', () => {
  const oversized = JSON.parse(readFileSync(new URL('./fixtures/legacy-overlimit.json', import.meta.url), 'utf8'))
  for (const [input, options] of [
    [oversized.fragment, undefined],
    ['BYUwNmD2Q', { password: 'synthetic secret' }],
    ['BYUwNmD2Q', { mode: 'secure' }],
  ]) {
    const result = api(input, options, 'readShareLink')
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('rejected')
  }
})
