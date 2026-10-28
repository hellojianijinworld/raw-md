const MAX_DOCUMENT_STORAGE = 1_000_000_000
const FALLBACK_DOCUMENT_STORAGE = 100_000_000
const STORAGE_HEADROOM_RATIO = 0.8

export function storageBudget(currentBytes: number, estimate?: StorageEstimate): { limit: number; target: number } {
  const valid =
    estimate?.quota !== undefined &&
    estimate.usage !== undefined &&
    Number.isFinite(estimate.quota) &&
    Number.isFinite(estimate.usage) &&
    estimate.quota > 0 &&
    estimate.usage >= 0
  const limit = valid
    ? Math.min(
        MAX_DOCUMENT_STORAGE,
        currentBytes + Math.floor(Math.max(0, estimate.quota! - estimate.usage!) * STORAGE_HEADROOM_RATIO),
      )
    : FALLBACK_DOCUMENT_STORAGE
  return { limit, target: Math.floor(limit * STORAGE_HEADROOM_RATIO) }
}

export async function readStorageEstimate(): Promise<StorageEstimate | undefined> {
  try {
    return await navigator.storage?.estimate?.()
  } catch {
    return undefined
  }
}

export type StoredDocument = {
  id: string
  kind: 'draft' | 'link'
  value: string
  content?: string
  title: string
  updatedAt: number
  pinned: boolean
}

type SaveOptions = { maxBytes?: number; targetBytes?: number; activeIds?: string[] }
const DB_NAME = 'raw-md-documents'
const STORE = 'documents'
const ACTIVE_STORE = 'activeTabs'
const ACTIVE_TIMEOUT = 24 * 60 * 60 * 1000

export function documentSize(doc: StoredDocument): number {
  return new TextEncoder().encode(JSON.stringify(doc)).byteLength
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' })
      if (!request.result.objectStoreNames.contains(ACTIVE_STORE))
        request.result.createObjectStore(ACTIVE_STORE, { keyPath: 'tabId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('다른 탭에서 문서함을 사용 중입니다.'))
  })
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).getAll()
    tx.oncomplete = () => {
      db.close()
      resolve(request.result as StoredDocument[])
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error ?? request.error)
    }
  })
}

export async function putDocument(doc: StoredDocument, options: SaveOptions = {}): Promise<void> {
  const estimate = options.maxBytes === undefined ? await readStorageEstimate() : undefined
  try {
    await writeDocument(doc, options, false, estimate)
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') throw error
    await writeDocument(doc, options, true, estimate)
  }
}

async function writeDocument(
  doc: StoredDocument,
  options: SaveOptions,
  reclaim: boolean,
  estimate?: StorageEstimate,
): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, ACTIVE_STORE], 'readwrite')
    const store = tx.objectStore(STORE)
    const request = store.getAll()
    const activeRequest = tx.objectStore(ACTIVE_STORE).getAll()
    let records: StoredDocument[] | undefined
    let active: { tabId: string; id: string; updatedAt: number }[] | undefined
    let failure: Error | undefined
    const prepare = () => {
      if (!records || !active) return
      const all = records
      const activeIds = new Set([
        ...(options.activeIds ?? []),
        ...active.filter((item) => item.updatedAt > Date.now() - ACTIVE_TIMEOUT).map((item) => item.id),
      ])
      const existing = all.find((item) => item.id === doc.id)
      const next = { ...doc, pinned: existing?.pinned ?? doc.pinned }
      const others = all.filter((item) => item.id !== doc.id)
      let total = documentSize(next) + others.reduce((sum, item) => sum + documentSize(item), 0)
      const budget = storageBudget(
        all.reduce((sum, item) => sum + documentSize(item), 0),
        estimate,
      )
      const limit = options.maxBytes ?? budget.limit
      const target = reclaim
        ? Math.min(options.targetBytes ?? budget.target, total - documentSize(next))
        : (options.targetBytes ?? budget.target)
      const removed: StoredDocument[] = []
      if (total > limit || reclaim) {
        const candidates = others
          .filter((item) => !item.pinned && !activeIds.has(item.id))
          .sort((a, b) => a.updatedAt - b.updatedAt)
        for (const item of candidates) {
          if (total <= target) break
          total -= documentSize(item)
          removed.push(item)
        }
      }
      if (total > limit) {
        failure = new Error('문서함 공간이 부족합니다. 문서를 다운로드하거나 보관을 해제해주세요.')
        tx.abort()
        return
      }
      for (const item of removed) store.delete(item.id)
      store.put(next)
    }
    request.onsuccess = () => {
      records = request.result as StoredDocument[]
      prepare()
    }
    activeRequest.onsuccess = () => {
      active = activeRequest.result
      prepare()
    }
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onabort = () => {
      db.close()
      reject(failure ?? tx.error ?? request.error)
    }
  })
}

export async function setActiveDocument(tabId: string, id: string | null): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIVE_STORE, 'readwrite')
    const store = tx.objectStore(ACTIVE_STORE)
    if (id) store.put({ tabId, id, updatedAt: Date.now() })
    else store.delete(tabId)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function protectOpenLink(tabId: string, payload: string): Promise<string | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, ACTIVE_STORE], 'readwrite')
    const request = tx.objectStore(STORE).getAll()
    let id: string | null = null
    request.onsuccess = () => {
      const doc = (request.result as StoredDocument[]).find((item) => item.kind === 'link' && item.value === payload)
      if (doc) {
        id = doc.id
        tx.objectStore(ACTIVE_STORE).put({ tabId, id, updatedAt: Date.now() })
      }
    }
    tx.oncomplete = () => {
      db.close()
      resolve(id)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error ?? request.error)
    }
  })
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function setDocumentPinned(id: string, pinned: boolean): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const request = store.get(id)
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, pinned })
    }
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error)
    }
  })
}
