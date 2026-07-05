import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rootRender = vi.fn()
let resolveCreateRootCall: (() => void) | undefined
const createRootMock = vi.fn(() => {
  resolveCreateRootCall?.()
  return { render: rootRender }
})
const migrateLegacyLocalStorage = vi.fn()
const installMobileViewportGuards = vi.fn()
const appImportOrder: string[] = []
const consoleError = vi.fn()
let resolveIndexedDbMigration: (() => void) | undefined
let rejectIndexedDbMigration: ((error?: unknown) => void) | undefined
let createRootCalled: Promise<void>

const migrateLegacyIndexedDb = vi.fn(
  () =>
    new Promise<void>((resolve, reject) => {
      appImportOrder.push('indexeddb')
      resolveIndexedDbMigration = resolve
      rejectIndexedDbMigration = reject
    }),
)

vi.mock('react-dom/client', () => ({
  createRoot: createRootMock,
}))

vi.mock('./lib/storageMigration', () => ({
  migrateLegacyLocalStorage: vi.fn(() => {
    migrateLegacyLocalStorage()
    appImportOrder.push('migrate')
  }),
}))

vi.mock('./lib/indexedDbMigration', () => ({
  migrateLegacyIndexedDb,
}))

vi.mock('./lib/viewport', () => ({
  installMobileViewportGuards,
}))

vi.mock('./App', () => ({
  default: () => null,
}))

describe('main bootstrap', () => {
  beforeEach(() => {
    resolveIndexedDbMigration = undefined
    rejectIndexedDbMigration = undefined
    resolveCreateRootCall = undefined
    createRootCalled = new Promise<void>((resolve) => {
      resolveCreateRootCall = resolve
    })
    consoleError.mockReset()
    vi.spyOn(console, 'error').mockImplementation(consoleError)
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    appImportOrder.length = 0
    resolveIndexedDbMigration = undefined
    rejectIndexedDbMigration = undefined
    resolveCreateRootCall = undefined
  })

  it('waits for IndexedDB migration to settle before rendering App', async () => {
    const rootElement = { id: 'root' } as HTMLElement
    const getRegistrations = vi.fn(async () => [])

    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations,
        register: vi.fn(),
      },
    })
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => rootElement),
    })
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
    })

    await import('./main')
    await Promise.resolve()

    expect(installMobileViewportGuards).toHaveBeenCalledOnce()
    expect(migrateLegacyLocalStorage).toHaveBeenCalledOnce()
    expect(migrateLegacyIndexedDb).toHaveBeenCalledOnce()
    expect(appImportOrder).toEqual(['migrate', 'indexeddb'])
    expect(createRootMock).not.toHaveBeenCalled()
    expect(rootRender).not.toHaveBeenCalled()

    resolveIndexedDbMigration?.()
    await createRootCalled
    await vi.dynamicImportSettled()

    expect(createRootMock).toHaveBeenCalledWith(rootElement)
    expect(rootRender).toHaveBeenCalledOnce()
    expect(getRegistrations).toHaveBeenCalledOnce()
  })

  it('renders App even when IndexedDB migration fails', async () => {
    const rootElement = { id: 'root' } as HTMLElement
    const getRegistrations = vi.fn(async () => [])
    const migrationError = new Error('boom')

    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations,
        register: vi.fn(),
      },
    })
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => rootElement),
    })
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
    })

    await import('./main')
    await Promise.resolve()

    expect(appImportOrder).toEqual(['migrate', 'indexeddb'])
    expect(createRootMock).not.toHaveBeenCalled()

    rejectIndexedDbMigration?.(migrationError)
    await createRootCalled
    await vi.dynamicImportSettled()

    expect(consoleError).toHaveBeenCalledWith('IndexedDB migration failed:', migrationError)
    expect(createRootMock).toHaveBeenCalledWith(rootElement)
    expect(rootRender).toHaveBeenCalledOnce()
    expect(getRegistrations).toHaveBeenCalledOnce()
  })
})
