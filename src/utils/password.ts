import { toBase64 } from './urlCodec'

export type ShareMode = 'plain' | 'custom' | 'secure'

export function generateSharePassword(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)))
}
