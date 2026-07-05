import {
  CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  CURRENT_PERSIST_KEY,
  LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  LEGACY_PERSIST_KEY,
} from './projectIdentity'

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function copyLocalStorageValue(storage: Storage, legacyKey: string, currentKey: string) {
  try {
    const current = storage.getItem(currentKey)
    if (current !== null) return

    const legacy = storage.getItem(legacyKey)
    if (legacy === null) return

    storage.setItem(currentKey, legacy)
  } catch {
    // Ignore storage access failures so startup migration never blocks app boot.
  }
}

export function migrateLegacyLocalStorage() {
  const storage = getLocalStorage()
  if (storage === null) return

  copyLocalStorageValue(storage, LEGACY_PERSIST_KEY, CURRENT_PERSIST_KEY)
  copyLocalStorageValue(storage, LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY, CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY)
}
