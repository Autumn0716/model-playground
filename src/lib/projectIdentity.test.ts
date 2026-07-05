import { describe, expect, it } from 'vitest'
import {
  CURRENT_PROJECT_SLUG,
  LEGACY_PROJECT_SLUG,
  CURRENT_REPO,
  LEGACY_REPO,
  CURRENT_PERSIST_KEY,
  LEGACY_PERSIST_KEY,
  CURRENT_DB_NAME,
  LEGACY_DB_NAME,
  CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  CURRENT_CACHE_PREFIX,
  LEGACY_CACHE_PREFIX,
} from './projectIdentity'

describe('project identity constants', () => {
  it('defines current and legacy identity values', () => {
    expect(CURRENT_PROJECT_SLUG).toBe('model-playground')
    expect(LEGACY_PROJECT_SLUG).toBe('gpt-image-playground')
    expect(CURRENT_REPO).toBe('Autumn0716/model-playground')
    expect(LEGACY_REPO).toBe('CookSleep/gpt_image_playground')
    expect(CURRENT_PERSIST_KEY).toBe('model-playground')
    expect(LEGACY_PERSIST_KEY).toBe('gpt-image-playground')
    expect(CURRENT_DB_NAME).toBe('model-playground')
    expect(LEGACY_DB_NAME).toBe('gpt-image-playground')
    expect(CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY).toBe('model-playground.copy-import-url-options')
    expect(LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY).toBe('gpt-image-playground.copy-import-url-options')
    expect(CURRENT_CACHE_PREFIX).toBe('model-playground-v')
    expect(LEGACY_CACHE_PREFIX).toBe('gpt-image-playground-v')
  })
})
