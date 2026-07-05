import {
  CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  CURRENT_PERSIST_KEY,
  LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  LEGACY_PERSIST_KEY,
} from './projectIdentity'

function copyLocalStorageValue(legacyKey: string, currentKey: string) {
  const current = window.localStorage.getItem(currentKey)
  if (current !== null) return

  const legacy = window.localStorage.getItem(legacyKey)
  if (legacy === null) return

  window.localStorage.setItem(currentKey, legacy)
}

export function migrateLegacyLocalStorage() {
  if (typeof window === 'undefined') return

  copyLocalStorageValue(LEGACY_PERSIST_KEY, CURRENT_PERSIST_KEY)
  copyLocalStorageValue(LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY, CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY)
}
