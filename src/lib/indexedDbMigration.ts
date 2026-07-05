import { CURRENT_DB_NAME, LEGACY_DB_NAME } from './projectIdentity'
import { DB_STORE_NAMES, STORE_MIGRATION_METADATA, openDbByName } from './db'

const LEGACY_RENAME_MIGRATION_ID = 'legacy-indexeddb-rename-v1'

interface MigrationMetadataRecord {
  id: string
  completedAt: number
}

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

function openExistingDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
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

function getMigrationCompletionRecord(db: IDBDatabase): Promise<MigrationMetadataRecord | undefined> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_MIGRATION_METADATA)) {
      resolve(undefined)
      return
    }

    const tx = db.transaction(STORE_MIGRATION_METADATA, 'readonly')
    const req = tx.objectStore(STORE_MIGRATION_METADATA).get(LEGACY_RENAME_MIGRATION_ID)
    req.onsuccess = () => resolve(req.result as MigrationMetadataRecord | undefined)
    req.onerror = () => reject(req.error)
  })
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

function putAllRecordsAndCompletionMarkerAtomically(
  db: IDBDatabase,
  recordsByStore: ReadonlyArray<readonly [string, unknown[]]>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [...recordsByStore.map(([storeName]) => storeName), STORE_MIGRATION_METADATA],
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

      tx.objectStore(STORE_MIGRATION_METADATA).put({
        id: LEGACY_RENAME_MIGRATION_ID,
        completedAt: Date.now(),
      } satisfies MigrationMetadataRecord)
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

  const legacyDb = await openExistingDb(LEGACY_DB_NAME)
  const currentDb = await openDbByName(CURRENT_DB_NAME)

  try {
    if (await getMigrationCompletionRecord(currentDb)) return

    const recordsByStore = await getLegacyRecords(legacyDb)
    await putAllRecordsAndCompletionMarkerAtomically(currentDb, recordsByStore)
  } finally {
    legacyDb.close()
    currentDb.close()
  }
}
