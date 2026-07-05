import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { CURRENT_DB_NAME, LEGACY_DB_NAME } from './projectIdentity'
import { migrateLegacyIndexedDb } from './indexedDbMigration'
import {
  DB_VERSION,
  STORE_TASKS,
  STORE_IMAGES,
  STORE_THUMBNAILS,
  STORE_AGENT_CONVERSATIONS,
  STORE_MIGRATION_METADATA,
} from './db'

const ALL_STORES = [STORE_TASKS, STORE_IMAGES, STORE_THUMBNAILS, STORE_AGENT_CONVERSATIONS, STORE_MIGRATION_METADATA]
const LEGACY_RENAME_MIGRATION_ID = 'legacy-indexeddb-rename-v1'

async function resetDb(name: string) {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}

function openTestDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      for (const store of ALL_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function putRecord(dbName: string, storeName: string, record: { id: string; [k: string]: unknown }) {
  const db = await openTestDb(dbName)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function clearStore(dbName: string, storeName: string) {
  const db = await openTestDb(dbName)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function getAllRecords(dbName: string, storeName: string): Promise<unknown[]> {
  const db = await openTestDb(dbName)
  const result = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

describe('migrateLegacyIndexedDb', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(async () => {
    await resetDb(LEGACY_DB_NAME)
    await resetDb(CURRENT_DB_NAME)
  })

  it('copies legacy task data into the current database', async () => {
    const task = { id: 'task-1', prompt: 'draw a cat', status: 'done', createdAt: 1000 }
    await putRecord(LEGACY_DB_NAME, STORE_TASKS, task)

    await migrateLegacyIndexedDb()

    const tasks = await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)
    expect(tasks).toEqual([task])
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_MIGRATION_METADATA)).toEqual([
      expect.objectContaining({ id: LEGACY_RENAME_MIGRATION_ID }),
    ])
  })

  it('does not overwrite an already completed migration when the current database has data', async () => {
    const legacyTask = { id: 'task-legacy', prompt: 'legacy prompt', status: 'done', createdAt: 1000 }
    const currentTask = { id: 'task-current', prompt: 'current prompt', status: 'done', createdAt: 2000 }

    await putRecord(LEGACY_DB_NAME, STORE_TASKS, legacyTask)
    await putRecord(CURRENT_DB_NAME, STORE_TASKS, currentTask)
    await putRecord(CURRENT_DB_NAME, STORE_MIGRATION_METADATA, { id: LEGACY_RENAME_MIGRATION_ID, completedAt: 1234 })

    await migrateLegacyIndexedDb()

    const tasks = await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)
    expect(tasks).toEqual([currentTask])
  })

  it('is idempotent after recording migration completion', async () => {
    const task = { id: 'task-1', prompt: 'draw a cat', status: 'done', createdAt: 1000 }
    await putRecord(LEGACY_DB_NAME, STORE_TASKS, task)

    await migrateLegacyIndexedDb()
    await migrateLegacyIndexedDb()

    const tasks = await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)
    expect(tasks).toEqual([task])
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_MIGRATION_METADATA)).toHaveLength(1)
  })

  it('copies multiple stores', async () => {
    const task = { id: 'task-1', prompt: 'test', status: 'done', createdAt: 1000 }
    const image = { id: 'img-1', dataUrl: 'data:image/png;base64,abc', createdAt: 1000, source: 'upload' }

    await putRecord(LEGACY_DB_NAME, STORE_TASKS, task)
    await putRecord(LEGACY_DB_NAME, STORE_IMAGES, image)

    await migrateLegacyIndexedDb()

    const tasks = await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)
    const images = await getAllRecords(CURRENT_DB_NAME, STORE_IMAGES)
    expect(tasks).toEqual([task])
    expect(images).toEqual([image])
  })

  it('does not strand partial data when a multi-store migration write fails', async () => {
    const task = { id: 'task-1', prompt: 'test', status: 'done', createdAt: 1000 }
    const image = { id: 'img-1', dataUrl: 'data:image/png;base64,abc', createdAt: 1000, source: 'upload' }

    await putRecord(LEGACY_DB_NAME, STORE_TASKS, task)
    await putRecord(LEGACY_DB_NAME, STORE_IMAGES, image)

    let failImageWrite = true
    const nativeTransaction = IDBDatabase.prototype.transaction
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (
      this: IDBDatabase,
      storeNames: string | Iterable<string>,
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions,
    ) {
      const tx = nativeTransaction.call(this, storeNames as never, mode, options)
      const targetsImagesStore = typeof storeNames === 'string'
        ? storeNames === STORE_IMAGES
        : Array.from(storeNames).includes(STORE_IMAGES)
      if (this.name === CURRENT_DB_NAME && mode === 'readwrite' && targetsImagesStore) {
        const store = tx.objectStore(STORE_IMAGES)
        const nativePut = store.put.bind(store)
        store.put = ((value: unknown, key?: IDBValidKey) => {
          if (failImageWrite) {
            failImageWrite = false
            throw new Error('simulated image write failure')
          }
          return nativePut(value, key)
        }) as typeof store.put
      }
      return tx
    })

    await expect(migrateLegacyIndexedDb()).rejects.toThrow('simulated image write failure')

    expect(await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)).toEqual([])
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_IMAGES)).toEqual([])
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_MIGRATION_METADATA)).toEqual([])

    await expect(migrateLegacyIndexedDb()).resolves.toBeUndefined()
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)).toEqual([task])
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_IMAGES)).toEqual([image])
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_MIGRATION_METADATA)).toEqual([
      expect.objectContaining({ id: LEGACY_RENAME_MIGRATION_ID }),
    ])
  })

  it('does not reimport legacy data after current user data is cleared post-migration', async () => {
    const legacyTask = { id: 'task-legacy', prompt: 'legacy prompt', status: 'done', createdAt: 1000 }
    const legacyImage = { id: 'img-legacy', dataUrl: 'data:image/png;base64,legacy', createdAt: 1000, source: 'upload' }

    await putRecord(LEGACY_DB_NAME, STORE_TASKS, legacyTask)
    await putRecord(LEGACY_DB_NAME, STORE_IMAGES, legacyImage)

    await migrateLegacyIndexedDb()
    await clearStore(CURRENT_DB_NAME, STORE_TASKS)
    await clearStore(CURRENT_DB_NAME, STORE_IMAGES)
    await clearStore(CURRENT_DB_NAME, STORE_THUMBNAILS)
    await clearStore(CURRENT_DB_NAME, STORE_AGENT_CONVERSATIONS)

    await migrateLegacyIndexedDb()

    expect(await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)).toEqual([])
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_IMAGES)).toEqual([])
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_MIGRATION_METADATA)).toEqual([
      expect.objectContaining({ id: LEGACY_RENAME_MIGRATION_ID }),
    ])
  })

  it('does not treat a failed migration as complete when current data is added later', async () => {
    const legacyTask = { id: 'task-legacy', prompt: 'legacy prompt', status: 'done', createdAt: 1000 }
    const currentTask = { id: 'task-current', prompt: 'current prompt', status: 'done', createdAt: 2000 }

    await putRecord(LEGACY_DB_NAME, STORE_TASKS, legacyTask)

    let failTaskWrite = true
    const nativeTransaction = IDBDatabase.prototype.transaction
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (
      this: IDBDatabase,
      storeNames: string | Iterable<string>,
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions,
    ) {
      const tx = nativeTransaction.call(this, storeNames as never, mode, options)
      const targetsTasksStore = typeof storeNames === 'string'
        ? storeNames === STORE_TASKS
        : Array.from(storeNames).includes(STORE_TASKS)
      if (this.name === CURRENT_DB_NAME && mode === 'readwrite' && targetsTasksStore) {
        const store = tx.objectStore(STORE_TASKS)
        const nativePut = store.put.bind(store)
        store.put = ((value: unknown, key?: IDBValidKey) => {
          if (failTaskWrite) {
            failTaskWrite = false
            throw new Error('simulated task write failure')
          }
          return nativePut(value, key)
        }) as typeof store.put
      }
      return tx
    })

    await expect(migrateLegacyIndexedDb()).rejects.toThrow('simulated task write failure')
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_MIGRATION_METADATA)).toEqual([])

    vi.restoreAllMocks()

    await putRecord(CURRENT_DB_NAME, STORE_TASKS, currentTask)
    await migrateLegacyIndexedDb()

    expect(await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)).toEqual([currentTask, legacyTask])
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_MIGRATION_METADATA)).toEqual([
      expect.objectContaining({ id: LEGACY_RENAME_MIGRATION_ID }),
    ])
  })

  it('no-ops gracefully when legacy database does not exist', async () => {
    await expect(migrateLegacyIndexedDb()).resolves.toBeUndefined()
    const tasks = await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)
    expect(tasks).toEqual([])
  })
})
