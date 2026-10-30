import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteDocument,
  deleteEmptyProtectedLink,
  listDocuments,
  protectOpenLink,
  putDocument,
  type StoredDocument,
  setActiveDocument,
  storageBudget,
} from '../utils/documentStorage'

const doc = (id: string, value: string, updatedAt: number, pinned = false): StoredDocument => ({
  id,
  value,
  updatedAt,
  pinned,
  kind: 'draft',
  title: id,
})

afterEach(async () => {
  for (const item of await listDocuments()) await deleteDocument(item.id)
})

describe('document storage', () => {
  it('skips blank writes without replacing a previously saved document', async () => {
    await putDocument(doc('existing', '본문만 있는 문서', 1))
    await putDocument(doc('existing', ' \n\t', 2))
    await putDocument(doc('empty', '', 3))
    await putDocument({ ...doc('empty-link', 'payload', 4), kind: 'link', content: '  ' })
    expect(await listDocuments()).toMatchObject([{ id: 'existing', value: '본문만 있는 문서' }])
  })

  it('removes only links with the verified empty encrypted payload', async () => {
    await putDocument({ ...doc('empty-one', 'e1.empty', 1), kind: 'link' })
    await putDocument({ ...doc('empty-two', 'e1.empty', 2), kind: 'link' })
    await putDocument({ ...doc('other-encrypted', 'e1.other', 3), kind: 'link' })
    await putDocument(doc('draft', 'e1.empty', 4))
    expect((await deleteEmptyProtectedLink('e1.empty')).sort()).toEqual(['empty-one', 'empty-two'])
    expect((await listDocuments()).map((item) => item.id).sort()).toEqual(['draft', 'other-encrypted'])
    expect(await deleteEmptyProtectedLink('e1.empty')).toEqual([])
    expect(await deleteEmptyProtectedLink('not-encrypted')).toEqual([])
  })

  it('removes previously saved blanks without guessing unknown or encrypted content', async () => {
    await listDocuments()
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('raw-md-documents', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('documents', 'readwrite')
      const store = tx.objectStore('documents')
      store.put(doc('legacy-blank', ' \n', 1))
      store.put({ ...doc('legacy-link-blank', 'payload', 2), kind: 'link', content: '' })
      store.put({ ...doc('legacy-link-unknown', 'old-payload', 3), kind: 'link' })
      store.put({ ...doc('encrypted', 'e1.example', 4), kind: 'link' })
      store.put({ ...doc('encrypted-with-empty-content', 'e1.example2', 4), kind: 'link', content: '' })
      store.put(doc('untitled', '본문만 있는 문서', 5))
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error)
    })
    db.close()
    expect((await listDocuments()).map((item) => item.id).sort()).toEqual([
      'encrypted',
      'encrypted-with-empty-content',
      'legacy-link-unknown',
      'untitled',
    ])
    const reopened = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('raw-md-documents', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const raw = await new Promise<StoredDocument[]>((resolve, reject) => {
      const request = reopened.transaction('documents').objectStore('documents').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    reopened.close()
    expect(raw.map((item) => item.id).sort()).toEqual([
      'encrypted',
      'encrypted-with-empty-content',
      'legacy-link-unknown',
      'untitled',
    ])
  })

  it('uses generous browser-dependent limits with headroom and a fallback', () => {
    expect(storageBudget(0, { quota: 10_000_000_000, usage: 1_000_000 })).toEqual({
      limit: 1_000_000_000,
      target: 800_000_000,
    })
    expect(storageBudget(2_000_000, { quota: 10_000_000, usage: 9_000_000 })).toEqual({
      limit: 2_800_000,
      target: 2_240_000,
    })
    expect(storageBudget(0)).toEqual({ limit: 100_000_000, target: 80_000_000 })
  })
  it('removes least recently used unpinned records but preserves protected and current documents', async () => {
    await putDocument(doc('old', 'a'.repeat(100), 1), { maxBytes: 10000, targetBytes: 500 })
    await putDocument(doc('pinned', 'a'.repeat(100), 2, true), { maxBytes: 10000, targetBytes: 500 })
    await putDocument(doc('current', 'a'.repeat(100), 3), { maxBytes: 10000, targetBytes: 500 })
    await putDocument(doc('new', 'a'.repeat(100), 4), { maxBytes: 600, targetBytes: 500, activeIds: ['current'] })
    expect((await listDocuments()).map((d) => d.id).sort()).toEqual(['current', 'new', 'pinned'])
  })

  it('preserves existing records when pinned documents prevent a new write', async () => {
    await putDocument(doc('pinned', 'x'.repeat(150), 1, true), { maxBytes: 10000, targetBytes: 100 })
    await expect(putDocument(doc('new', 'y'.repeat(500), 2), { maxBytes: 300, targetBytes: 100 })).rejects.toThrow()
    expect((await listDocuments()).map((d) => d.id)).toEqual(['pinned'])
  })

  it('replaces a record without dropping its pin and counts UTF-8 data', async () => {
    await putDocument(doc('one', 'a', 1, true))
    await putDocument(doc('one', '한글', 2))
    const [item] = await listDocuments()
    expect(item.value).toBe('한글')
    expect(item.pinned).toBe(true)
  })

  it('protects a document currently open in another tab', async () => {
    await putDocument(doc('active', 'a'.repeat(100), 1))
    await putDocument(doc('old', 'b'.repeat(100), 2))
    await setActiveDocument('other-tab', 'active')
    try {
      await putDocument(doc('new', 'c'.repeat(100), 3), { maxBytes: 450, targetBytes: 400 })
      expect((await listDocuments()).map((item) => item.id).sort()).toEqual(['active', 'new'])
    } finally {
      await setActiveDocument('other-tab', null)
    }
  })

  it('registers a locked link as active before it is decrypted', async () => {
    await putDocument({ ...doc('locked', 'e1.example', 1), kind: 'link' })
    expect(await protectOpenLink('locked-tab', 'e1.example')).toBe('locked')
    try {
      await expect(putDocument(doc('new', 'a'.repeat(200), 2), { maxBytes: 200, targetBytes: 100 })).rejects.toThrow()
      expect((await listDocuments()).map((item) => item.id)).toEqual(['locked'])
    } finally {
      await setActiveDocument('locked-tab', null)
    }
  })
})
