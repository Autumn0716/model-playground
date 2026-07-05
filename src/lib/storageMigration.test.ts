import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  CURRENT_PERSIST_KEY,
  LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  LEGACY_PERSIST_KEY,
} from './projectIdentity'
import { migrateLegacyLocalStorage } from './storageMigration'

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.get(key) ?? null
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, value)
    },
  }
}

describe('migrateLegacyLocalStorage', () => {
  beforeEach(() => {
    const localStorage = createLocalStorageMock()
    vi.stubGlobal('window', { localStorage })
    vi.stubGlobal('localStorage', localStorage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('copies legacy persisted state into the current key when current key is missing', () => {
    localStorage.setItem(LEGACY_PERSIST_KEY, JSON.stringify({ state: { prompt: 'legacy' }, version: 2 }))

    migrateLegacyLocalStorage()

    expect(localStorage.getItem(CURRENT_PERSIST_KEY)).toBe(JSON.stringify({ state: { prompt: 'legacy' }, version: 2 }))
  })

  it('does not overwrite current persisted state with legacy state', () => {
    localStorage.setItem(LEGACY_PERSIST_KEY, JSON.stringify({ state: { prompt: 'legacy' }, version: 2 }))
    localStorage.setItem(CURRENT_PERSIST_KEY, JSON.stringify({ state: { prompt: 'current' }, version: 2 }))

    migrateLegacyLocalStorage()

    expect(localStorage.getItem(CURRENT_PERSIST_KEY)).toBe(JSON.stringify({ state: { prompt: 'current' }, version: 2 }))
  })

  it('migrates ancillary copy-import-url options key', () => {
    localStorage.setItem(LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY, JSON.stringify({ useNewApiKey: true }))

    migrateLegacyLocalStorage()

    expect(localStorage.getItem(CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY)).toBe(JSON.stringify({ useNewApiKey: true }))
  })

  it('is safe to run more than once', () => {
    localStorage.setItem(LEGACY_PERSIST_KEY, JSON.stringify({ state: { prompt: 'legacy' }, version: 2 }))

    migrateLegacyLocalStorage()
    migrateLegacyLocalStorage()

    expect(localStorage.getItem(CURRENT_PERSIST_KEY)).toBe(JSON.stringify({ state: { prompt: 'legacy' }, version: 2 }))
  })

  it('does not throw during startup when localStorage access fails', () => {
    const securityError = new DOMException('Access denied', 'SecurityError')
    const windowWithFailingStorage = {}

    Object.defineProperty(windowWithFailingStorage, 'localStorage', {
      configurable: true,
      get() {
        throw securityError
      },
    })

    vi.stubGlobal('window', windowWithFailingStorage)

    expect(() => migrateLegacyLocalStorage()).not.toThrow()
  })
})
