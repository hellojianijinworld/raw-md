import { createReadStream, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib'
import { decryptMarkdown, encryptMarkdown } from '../src/utils/encryption'
import { generateSharePassword, type ShareMode } from '../src/utils/password'
import { parseShareFragment } from '../src/utils/shareFragment'
import {
  type BrotliDecoder,
  type BrotliEncoder,
  decodeMarkdown,
  encodeMarkdown,
  MAX_HASH_LENGTH,
} from '../src/utils/urlCodec'

const MAX_SOURCE_BYTES = 4 * 1024 * 1024
const MAX_PASSWORD_BYTES = 4096
const MAX_LINK_BYTES = MAX_HASH_LENGTH + 8192
const DEFAULT_BASE_URL = 'https://raw-md.pages.dev/'
const brotli: BrotliEncoder & BrotliDecoder = {
  compress: (bytes, options) =>
    brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: options?.quality ?? 11 } }),
  decompressBounded: (input, limit) => {
    // Node's info result exposes consumed bytes, so trailing streams cannot bypass framing validation.
    const result = brotliDecompressSync(input, { maxOutputLength: Math.max(1, limit), info: true }) as unknown as {
      buffer: Uint8Array
      engine: { bytesWritten: number }
    }
    if (result.buffer.length > limit || result.engine.bytesWritten !== input.length)
      throw new Error('Invalid compressed data.')
    return result.buffer
  },
}

export interface ShareOptions {
  mode?: ShareMode
  password?: string
  baseUrl?: string
  output?: 'url' | 'fragment'
}

interface ShareMetadata {
  formatVersion: 2
  mode: ShareMode
  sourceBytes: number
  password?: string
}

export type ShareLink = ShareMetadata & ({ url: string; urlLength: number } | { fragment: string })

export interface ReadOptions {
  password?: string
}

export interface ReadShareLink {
  formatVersion: 2
  markdown: string
  sourceBytes: number
  encrypted: boolean
  heading?: number
}

function validOptions(options: unknown, keys: string[]): void {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    Object.keys(options).some((key) => !keys.includes(key))
  )
    throw new Error('Unsupported options.')
}

function validPassword(password: unknown): asserts password is string {
  if (
    typeof password !== 'string' ||
    !password ||
    /[\r\n]/.test(password) ||
    Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES
  )
    throw new Error('Use a nonempty single-line password of at most 4096 UTF-8 bytes.')
}

function requireNode(): void {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or newer is required.')
}

function baseUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Invalid base URL.')
  }
  const loopback =
    url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    value.includes('?') ||
    value.includes('#')
  )
    throw new Error('Use an absolute HTTPS URL or an HTTP loopback URL without credentials, query, or fragment.')
  return url.href
}

export async function createShareLink(markdown: string, options: ShareOptions = {}): Promise<ShareLink> {
  requireNode()
  validOptions(options, ['mode', 'password', 'baseUrl', 'output'])
  const output = options.output === undefined ? 'url' : options.output
  if (output !== 'url' && output !== 'fragment') throw new Error('Unsupported output format.')
  if (typeof markdown !== 'string') throw new Error('Markdown must be a string.')
  const sourceBytes = Buffer.byteLength(markdown, 'utf8')
  if (sourceBytes > MAX_SOURCE_BYTES) throw new Error('Markdown exceeds the 4 MiB UTF-8 limit.')
  const mode = options.mode === undefined ? 'plain' : options.mode
  if (mode !== 'plain' && mode !== 'custom' && mode !== 'secure') throw new Error('Unsupported share mode.')
  if (mode !== 'custom' && options.password !== undefined) throw new Error('Only custom mode accepts a password.')
  if (mode === 'custom') validPassword(options.password)
  const base = baseUrl(options.baseUrl ?? DEFAULT_BASE_URL)
  const password = mode === 'secure' ? generateSharePassword() : options.password
  const fragment =
    mode === 'plain' ? encodeMarkdown(markdown, brotli) : await encryptMarkdown(markdown, brotli, password!)
  const url = `${base}#${fragment}`
  return {
    formatVersion: 2,
    mode,
    ...(output === 'fragment' ? { fragment } : { url, urlLength: url.length }),
    sourceBytes,
    ...(mode === 'secure' ? { password } : {}),
  }
}

export async function readShareLink(input: string, options: ReadOptions = {}): Promise<ReadShareLink> {
  try {
    requireNode()
    validOptions(options, ['password'])
    if (typeof input !== 'string' || input.length > MAX_LINK_BYTES) throw new Error('Invalid input.')
    const value = input.trim()
    let fragment = value.startsWith('#') ? value.slice(1) : value
    if (/^https?:\/\//i.test(value)) fragment = new URL(value).hash.slice(1)
    else if (/^[a-z][a-z\d+.-]*:/i.test(value)) throw new Error('Unsupported URL.')
    if (!fragment || fragment.length > MAX_HASH_LENGTH) throw new Error('Invalid fragment.')
    const position = parseShareFragment(fragment)
    fragment = position.payload
    const hash = decodeURIComponent(fragment)
    const encrypted = hash.startsWith('e1.')
    if (encrypted) validPassword(options.password)
    else if (options.password !== undefined) throw new Error('This link does not accept a password.')
    const markdown = encrypted
      ? await decryptMarkdown(hash, brotli, options.password!)
      : decodeMarkdown(fragment, brotli)
    return {
      formatVersion: 2,
      markdown,
      sourceBytes: Buffer.byteLength(markdown, 'utf8'),
      encrypted,
      ...(position.heading === undefined ? {} : { heading: position.heading }),
    }
  } catch {
    throw new Error('Could not read share link. Check input and password.')
  }
}

async function readLimitedUtf8(stream: AsyncIterable<Uint8Array>, limit: number): Promise<string> {
  const chunks: Uint8Array[] = []
  let bytes = 0
  for await (const chunk of stream) {
    bytes += chunk.byteLength
    if (bytes > limit) throw new Error('Input exceeds its byte limit.')
    chunks.push(chunk)
  }
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks, bytes))
}

const help = `Usage: node share.mjs [options]

Create or read a raw-md share link locally using Node.js 22+. No network access or package install is needed.
JSON is written to stdout. Encoding emits exactly one URL or fragment; decoding emits Markdown once.
Secure mode includes its generated password separately from the URL or fragment.

  --input PATH|-         UTF-8 file, or - for stdin (default: stdin); Markdown maximum 4 MiB
  --mode MODE            plain | custom | secure (encode only; default: plain)
  --output FORMAT        url | fragment (encode only; default: url)
  --password-file PATH   Exact UTF-8 password file, for custom encode or encrypted decode; no CR/LF; maximum 4096 bytes
  --base-url URL         Absolute HTTPS or HTTP loopback URL (encode only; default: https://raw-md.pages.dev/)
  --decode               Read a full HTTP(S) URL, #fragment, or raw fragment from input without fetching it
  --help                 Show this help

Passwords are never accepted as command-line arguments. Password files are read without trimming.
`

async function runCli(): Promise<void> {
  try {
    const { values } = parseArgs({
      options: {
        input: { type: 'string', default: '-' },
        mode: { type: 'string' },
        output: { type: 'string' },
        decode: { type: 'boolean' },
        'password-file': { type: 'string' },
        'base-url': { type: 'string' },
        help: { type: 'boolean' },
      },
    })
    if (values.help) {
      process.stdout.write(help)
      return
    }
    if (values.decode) {
      if (values.mode !== undefined || values.output !== undefined || values['base-url'] !== undefined)
        throw new Error('Decode cannot be combined with encode options.')
    } else if (
      (values.mode ?? 'plain') === 'custom'
        ? values['password-file'] === undefined
        : values['password-file'] !== undefined
    )
      throw new Error('Password files are required only for custom mode.')
    const password =
      values['password-file'] === undefined
        ? undefined
        : await readLimitedUtf8(createReadStream(values['password-file']), MAX_PASSWORD_BYTES)
    const input = await readLimitedUtf8(
      values.input === '-' ? process.stdin : createReadStream(values.input),
      values.decode ? MAX_LINK_BYTES : MAX_SOURCE_BYTES,
    )
    const result = values.decode
      ? await readShareLink(input, { password })
      : await createShareLink(input, {
          mode: values.mode as ShareMode,
          output: values.output as ShareOptions['output'],
          password,
          baseUrl: values['base-url'],
        })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch {
    process.stderr.write('raw-md: Could not process share link. Check input, options, password, and Node.js 22+.\n')
    process.exitCode = 1
  }
}

function isEntryPoint(): boolean {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

// Comparing resolved paths keeps renamed downloads and symlinks executable without running on import.
if (isEntryPoint()) await runCli()
