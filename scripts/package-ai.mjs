import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const integrationFiles = [
  '.agents/plugins/marketplace.json',
  '.claude-plugin/marketplace.json',
  'INSTALL.md',
  'plugin/.claude-plugin/plugin.json',
  'plugin/plugin.json',
]
const skillFiles = ['SKILL.md', 'scripts/share.mjs', 'scripts/share.mjs.sha256']
const files = await Promise.all([
  ...integrationFiles.map(async (path) => [path, await readFile(new URL(`integrations/ai/${path}`, root))]),
  ...skillFiles.map(async (path) => [
    `plugin/skills/raw-md-export/${path}`,
    await readFile(new URL(`skills/raw-md-export/${path}`, root)),
  ]),
])
const sdk = files.find(([path]) => path.endsWith('/share.mjs'))[1]
const sdkSha256 = createHash('sha256').update(sdk).digest('hex')
if (
  !sdk.equals(await readFile(new URL('public/codec/v2/share.mjs', root))) ||
  (await readFile(new URL('skills/raw-md-export/scripts/share.mjs.sha256', root), 'utf8')) !==
    `${sdkSha256}  share.mjs\n`
) {
  throw new Error('SDK snapshots or checksum differ; run npm run build:codec first.')
}

// Stored entries and a fixed DOS date keep the small allowlisted archive reproducible.
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  return crc >>> 0
})
const localEntries = []
const centralEntries = []
let offset = 0
for (const [path, bytes] of files.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
  const name = Buffer.from(`raw-md-ai/${path}`)
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]
  crc = (crc ^ 0xffffffff) >>> 0
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(0x800, 6)
  local.writeUInt16LE(0x21, 12)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(bytes.length, 18)
  local.writeUInt32LE(bytes.length, 22)
  local.writeUInt16LE(name.length, 26)
  localEntries.push(local, name, bytes)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(0x800, 8)
  central.writeUInt16LE(0x21, 14)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(bytes.length, 20)
  central.writeUInt32LE(bytes.length, 24)
  central.writeUInt16LE(name.length, 28)
  central.writeUInt32LE(offset, 42)
  centralEntries.push(central, name)
  offset += local.length + name.length + bytes.length
}
const central = Buffer.concat(centralEntries)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(files.length, 8)
end.writeUInt16LE(files.length, 10)
end.writeUInt32LE(central.length, 12)
end.writeUInt32LE(offset, 16)
const archive = Buffer.concat([...localEntries, central, end])
const { version } = JSON.parse(await readFile(new URL('integrations/ai/plugin/plugin.json', root), 'utf8'))
const manifest = {
  version,
  artifact: 'raw-md-ai.zip',
  sha256: createHash('sha256').update(archive).digest('hex'),
  bytes: archive.length,
  sdkSha256,
  runtime: 'node >=22',
  cli: 'plugin/skills/raw-md-export/scripts/share.mjs',
}
await mkdir(new URL('public/ai/', root), { recursive: true })
await writeFile(new URL('public/ai/INSTALL.md', root), files.find(([path]) => path === 'INSTALL.md')[1])
await writeFile(new URL('public/ai/raw-md-ai.zip', root), archive)
await writeFile(new URL('public/ai/manifest.json', root), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Optional AI package: ${archive.length} bytes, sha256 ${manifest.sha256}`)
