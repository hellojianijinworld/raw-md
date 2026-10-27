import LZString from 'lz-string'
import { type Brotli, decodeMarkdown, encodeMarkdown, fromBase64, MAX_HASH_LENGTH, toBase64 } from './urlCodec'

// e1 fixes the KDF parameters; links cannot request attacker-controlled memory or work.
const additionalData = new TextEncoder().encode('raw-md:e1:argon2id:65536:3:1:aes-256-gcm')
const unlockError = () => new Error('비밀번호가 올바르지 않거나 링크가 손상되었습니다.')

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!password) throw new Error('비밀번호를 입력해주세요.')
  const { argon2id } = await import('hash-wasm')
  const bytes = await argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'binary',
  })
  try {
    return await crypto.subtle.importKey('raw', new Uint8Array(bytes), 'AES-GCM', false, ['encrypt', 'decrypt'])
  } finally {
    bytes.fill(0)
  }
}

export async function encryptMarkdown(markdown: string, brotli: Brotli, password: string): Promise<string> {
  const hash = encodeMarkdown(markdown, brotli)
  const codec = hash.startsWith('b1.') ? 1 : hash.startsWith('j1.') ? 2 : 0
  const compressed = codec ? fromBase64(hash.slice(3)) : LZString.compressToUint8Array(markdown)
  const payload = new Uint8Array(compressed.length + 1)
  payload[0] = codec
  payload.set(compressed, 1)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData, tagLength: 128 }, key, payload)
  const envelope = new Uint8Array(28 + ciphertext.byteLength)
  envelope.set(salt)
  envelope.set(iv, 16)
  envelope.set(new Uint8Array(ciphertext), 28)
  return `e1.${toBase64(envelope)}`
}

export async function decryptMarkdown(hash: string, brotli: Brotli, password: string): Promise<string> {
  if (hash.length > MAX_HASH_LENGTH) throw new Error('공유 링크가 너무 깁니다.')
  if (!hash.startsWith('e1.')) throw new Error('지원하지 않는 공유 링크 형식입니다.')
  const envelope = fromBase64(hash.slice(3))
  if (envelope.length < 46) throw unlockError()
  const key = await deriveKey(password, envelope.subarray(0, 16))
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: envelope.subarray(16, 28), additionalData, tagLength: 128 },
      key,
      envelope.subarray(28),
    )
  } catch {
    throw unlockError()
  }
  const payload = new Uint8Array(plaintext)
  const codec = payload[0]
  if (codec === 1 || codec === 2)
    return decodeMarkdown(`${codec === 1 ? 'b1.' : 'j1.'}${toBase64(payload.subarray(1))}`, brotli)
  if (codec !== 0 || payload.length % 2 !== 1) throw unlockError()
  const text = LZString.decompressFromUint8Array(payload.subarray(1))
  if (text === null || toBase64(LZString.compressToUint8Array(text)) !== toBase64(payload.subarray(1)))
    throw unlockError()
  return decodeMarkdown(LZString.compressToEncodedURIComponent(text))
}
