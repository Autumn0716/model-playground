import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GENERAL_API_PROFILE_ID,
  createDefaultGeneralApiProfile,
  normalizeGeneralApiProfile,
  normalizeModelGroup,
  normalizeGeneralApiProfiles,
  normalizeModelGroups,
} from './generalApiProfiles'

describe('createDefaultGeneralApiProfile', () => {
  it('creates a profile with default id when no override', () => {
    const profile = createDefaultGeneralApiProfile()
    expect(profile.id).toBe(DEFAULT_GENERAL_API_PROFILE_ID)
    expect(profile.name).toBe('默认')
    expect(profile.baseUrl).toBe('')
    expect(profile.apiKey).toBe('')
    expect(profile.apiMode).toBe('chat')
    expect(profile.apiProxy).toBe(false)
  })

  it('applies overrides', () => {
    const profile = createDefaultGeneralApiProfile({ id: 'x', name: '中转', baseUrl: 'https://a/v1', apiKey: 'sk-1', apiMode: 'responses', apiProxy: true })
    expect(profile.id).toBe('x')
    expect(profile.name).toBe('中转')
    expect(profile.apiMode).toBe('responses')
  })
})

describe('normalizeGeneralApiProfile', () => {
  it('returns default for invalid input', () => {
    expect(normalizeGeneralApiProfile(null)).toEqual(createDefaultGeneralApiProfile())
    expect(normalizeGeneralApiProfile({})).toEqual(createDefaultGeneralApiProfile())
  })

  it('normalizes fields with fallbacks', () => {
    const result = normalizeGeneralApiProfile({ id: 'p1', name: '  ', baseUrl: 123, apiMode: 'invalid' })
    expect(result.id).toBe('p1')
    expect(result.name).toBe('新配置')
    expect(result.baseUrl).toBe('')
    expect(result.apiMode).toBe('chat')
  })

  it('keeps valid apiMode responses', () => {
    const result = normalizeGeneralApiProfile({ id: 'p1', apiMode: 'responses' })
    expect(result.apiMode).toBe('responses')
  })
})

describe('normalizeGeneralApiProfiles', () => {
  it('returns array with default profile for empty input', () => {
    const result = normalizeGeneralApiProfiles([])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(DEFAULT_GENERAL_API_PROFILE_ID)
  })

  it('returns array with default profile for invalid input', () => {
    expect(normalizeGeneralApiProfiles(null as any)).toHaveLength(1)
    expect(normalizeGeneralApiProfiles(undefined as any)).toHaveLength(1)
  })

  it('normalizes each profile', () => {
    const result = normalizeGeneralApiProfiles([{ id: 'p1', name: 'a' }, { id: 'p2', name: 'b' }])
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('a')
    expect(result[1].name).toBe('b')
  })
})

describe('normalizeModelGroup', () => {
  it('returns null for invalid input', () => {
    expect(normalizeModelGroup(null)).toBeNull()
    expect(normalizeModelGroup({})).toBeNull()
  })

  it('requires id and profileId', () => {
    expect(normalizeModelGroup({ id: 'g1' })).toBeNull()
    expect(normalizeModelGroup({ profileId: 'p1' })).toBeNull()
  })

  it('normalizes a valid group', () => {
    const result = normalizeModelGroup({ id: 'g1', name: 'gpt', profileId: 'p1', modelIds: ['gpt-4o', 123, null] })
    expect(result).not.toBeNull()
    expect(result!.modelIds).toEqual(['gpt-4o'])
    expect(result!.name).toBe('gpt')
    expect(result!.createdAt).toBeGreaterThan(0)
  })
})

describe('normalizeModelGroups', () => {
  it('returns empty array for invalid input', () => {
    expect(normalizeModelGroups(null)).toEqual([])
    expect(normalizeModelGroups(undefined)).toEqual([])
    expect(normalizeModelGroups('x' as any)).toEqual([])
  })

  it('filters out invalid groups', () => {
    const result = normalizeModelGroups([{ id: 'g1', profileId: 'p1' }, { id: 'invalid' }, null])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('g1')
  })
})
