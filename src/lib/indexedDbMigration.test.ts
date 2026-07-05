import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { CURRENT_DB_NAME, LEGACY_DB_NAME } from './projectIdentity'
import { migrateLegacyIndexedDb } from './indexedDbMigration'
import { DB_VERSION, STORE_TASKS, STORE_IMAGES, STORE_THUMBNAILS, STORE_AGENT_CONVERSATIONS } from './db'

const ALL_STORES = [STORE_TASKS, STORE_IMAGES, STORE_THUMBNAILS, STORE_AGENT_CONVERSATIONS]

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
  })

  it('does not overwrite an already populated current database', async () => {
    const legacyTask = { id: 'task-legacy', prompt: 'legacy prompt', status: 'done', createdAt: 1000 }
    const currentTask = { id: 'task-current', prompt: 'current prompt', status: 'done', createdAt: 2000 }

    await putRecord(LEGACY_DB_NAME, STORE_TASKS, legacyTask)
    await putRecord(CURRENT_DB_NAME, STORE_TASKS, currentTask)

    await migrateLegacyIndexedDb()

    const tasks = await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)
    expect(tasks).toEqual([currentTask])
  })

  it('does not merge legacy data when the current database already has records in another store', async () => {
    const legacyTask = { id: 'task-legacy', prompt: 'legacy prompt', status: 'done', createdAt: 1000 }
    const currentImage = { id: 'img-current', dataUrl: 'data:image/png;base64,current', createdAt: 2000, source: 'upload' }

    await putRecord(LEGACY_DB_NAME, STORE_TASKS, legacyTask)
    await putRecord(CURRENT_DB_NAME, STORE_IMAGES, currentImage)

    await migrateLegacyIndexedDb()

    const tasks = await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)
    const images = await getAllRecords(CURRENT_DB_NAME, STORE_IMAGES)
    expect(tasks).toEqual([])
    expect(images).toEqual([currentImage])
  })

  it('is idempotent', async () => {
    const task = { id: 'task-1', prompt: 'draw a cat', status: 'done', createdAt: 1000 }
    await putRecord(LEGACY_DB_NAME, STORE_TASKS, task)

    await migrateLegacyIndexedDb()
    await migrateLegacyIndexedDb()

    const tasks = await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)
    expect(tasks).toEqual([task])
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
      storeNames: string | string[],
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions,
    ) {
      const tx = nativeTransaction.call(this, storeNames as never, mode, options)
      const targetsImagesStore = Array.isArray(storeNames)
        ? storeNames.includes(STORE_IMAGES)
        : storeNames === STORE_IMAGES
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

    await expect(migrateLegacyIndexedDb()).resolves.toBeUndefined()
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)).toEqual([task])
    expect(await getAllRecords(CURRENT_DB_NAME, STORE_IMAGES)).toEqual([image])
  })

  it('no-ops gracefully when legacy database does not exist', async () => {
    await expect(migrateLegacyIndexedDb()).resolves.toBeUndefined()
    const tasks = await getAllRecords(CURRENT_DB_NAME, STORE_TASKS)
    expect(tasks).toEqual([])
  })
})
