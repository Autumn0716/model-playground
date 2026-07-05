import { CURRENT_DB_NAME, LEGACY_DB_NAME } from './projectIdentity'
import { DB_STORE_NAMES, openDbByName } from './db'

function dbExists(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = indexedDB.open(name)
    let existed = true

    req.onupgradeneeded = () => {
      existed = false
      req.transaction?.abort()
    }
    req.onsuccess = () => {
      req.result.close()
      resolve(existed)
    }
    req.onerror = () => {
      resolve(existed)
    }
  })
}

function getAllRecords(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve([])
      return
    }

    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function storeHasRecords(db: IDBDatabase, storeName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve(false)
      return
    }

    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).count()
    req.onsuccess = () => resolve(req.result > 0)
    req.onerror = () => reject(req.error)
  })
}

async function databaseHasRecords(db: IDBDatabase): Promise<boolean> {
  for (const storeName of DB_STORE_NAMES) {
    if (await storeHasRecords(db, storeName)) {
      return true
    }
  }

  return false
}

async function getLegacyRecords(db: IDBDatabase): Promise<Array<readonly [string, unknown[]]>> {
  const recordsByStore: Array<readonly [string, unknown[]]> = []

  for (const storeName of DB_STORE_NAMES) {
    const records = await getAllRecords(db, storeName)
    if (records.length > 0) {
      recordsByStore.push([storeName, records] as const)
    }
  }

  return recordsByStore
}

function putAllRecordsAtomically(db: IDBDatabase, recordsByStore: ReadonlyArray<readonly [string, unknown[]]>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (recordsByStore.length === 0) {
      resolve()
      return
    }

    const tx = db.transaction(
      recordsByStore.map(([storeName]) => storeName),
      'readwrite',
    )

    let settled = false
    const resolveOnce = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const rejectOnce = (error: unknown) => {
      if (settled) return
      settled = true
      reject(error)
    }

    tx.oncomplete = () => resolveOnce()
    tx.onerror = () => rejectOnce(tx.error ?? new Error('IndexedDB migration transaction failed'))
    tx.onabort = () => rejectOnce(tx.error ?? new Error('IndexedDB migration transaction aborted'))

    try {
      for (const [storeName, records] of recordsByStore) {
        const store = tx.objectStore(storeName)
        for (const record of records) {
          store.put(record)
        }
      }
    } catch (error) {
      try {
        tx.abort()
      } catch {
        // Ignore abort errors from transactions that already started failing.
      }
      rejectOnce(error)
    }
  })
}

export async function migrateLegacyIndexedDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') return

  const legacyExists = await dbExists(LEGACY_DB_NAME)
  if (!legacyExists) return

  const legacyDb = await openDbByName(LEGACY_DB_NAME)
  const currentDb = await openDbByName(CURRENT_DB_NAME)

  try {
    if (await databaseHasRecords(currentDb)) return

    const recordsByStore = await getLegacyRecords(legacyDb)
    await putAllRecordsAtomically(currentDb, recordsByStore)
  } finally {
    legacyDb.close()
    currentDb.close()
  }
}
