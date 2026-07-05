import { afterEach, describe, expect, it, vi } from 'vitest'

const rootRender = vi.fn()
const createRootMock = vi.fn(() => ({ render: rootRender }))
const migrateLegacyLocalStorage = vi.fn()
const installMobileViewportGuards = vi.fn()
const appImportOrder: string[] = []

vi.mock('react-dom/client', () => ({
  createRoot: createRootMock,
}))

vi.mock('./lib/storageMigration', () => ({
  migrateLegacyLocalStorage: vi.fn(() => {
    migrateLegacyLocalStorage()
    appImportOrder.push('migrate')
  }),
}))

vi.mock('./lib/viewport', () => ({
  installMobileViewportGuards,
}))

vi.mock('./App', () => {
  appImportOrder.push('app-import')
  return {
    default: () => null,
  }
})

describe('main bootstrap', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    appImportOrder.length = 0
  })

  it('runs localStorage migration before importing App', async () => {
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
    await vi.dynamicImportSettled()

    expect(installMobileViewportGuards).toHaveBeenCalledOnce()
    expect(migrateLegacyLocalStorage).toHaveBeenCalledOnce()
    expect(appImportOrder).toEqual(['migrate', 'app-import'])
    expect(createRootMock).toHaveBeenCalledWith(rootElement)
    expect(rootRender).toHaveBeenCalledOnce()
    expect(getRegistrations).toHaveBeenCalledOnce()
  })
})
