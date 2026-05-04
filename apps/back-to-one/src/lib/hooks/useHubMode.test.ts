import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Stub a minimal localStorage on global. The hook reads it via
// `window.localStorage`; we expose `window` + `localStorage` so the
// pure helpers (readHubMode/writeHubMode) work in the node env this
// repo's vitest is configured for (no jsdom dep — see vitest.config.ts).
function makeStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() { return store.size },
    clear: () => store.clear(),
    getItem: (k: string) => store.has(k) ? store.get(k)! : null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  }
}

describe('useHubMode storage helpers', () => {
  const projectId = 'p-test-123'
  const KEY = `hub-mode:${projectId}`

  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage())
    vi.stubGlobal('window', { localStorage: globalThis.localStorage })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    // Force a re-import so the hook's typeof-window guard re-evaluates fresh
    vi.resetModules()
  })

  it('readHubMode returns null when no value stored', async () => {
    const { readHubMode } = await import('./useHubMode')
    expect(readHubMode(projectId)).toBeNull()
  })

  it('writeHubMode persists to localStorage under the project-namespaced key', async () => {
    const { writeHubMode, readHubMode } = await import('./useHubMode')
    writeHubMode(projectId, 'creative')
    expect(localStorage.getItem(KEY)).toBe('creative')
    expect(readHubMode(projectId)).toBe('creative')
  })

  it('writeHubMode rejects invalid values defensively', async () => {
    const { writeHubMode, readHubMode } = await import('./useHubMode')
    writeHubMode(projectId, 'creative')
    // @ts-expect-error testing runtime guard
    writeHubMode(projectId, 'bogus')
    expect(readHubMode(projectId)).toBe('creative')
  })

  it('different projectIds get independent values', async () => {
    const { writeHubMode, readHubMode } = await import('./useHubMode')
    writeHubMode('a', 'creative')
    writeHubMode('b', 'production')
    expect(readHubMode('a')).toBe('creative')
    expect(readHubMode('b')).toBe('production')
  })
})
