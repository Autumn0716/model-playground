import { describe, expect, it } from 'vitest'
import { groupModelsByLcp } from './modelGrouping'

describe('groupModelsByLcp', () => {
  it('returns empty array for empty input', () => {
    expect(groupModelsByLcp([])).toEqual([])
  })

  it('returns single self-named group for single model', () => {
    const result = groupModelsByLcp(['dall-e-3'])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('dall-e-3')
    expect(result[0].models).toEqual([{ id: 'dall-e-3' }])
  })

  it('groups models with common gpt prefix', () => {
    const result = groupModelsByLcp(['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('gpt')
    expect(result[0].models.map((m) => m.id).sort()).toEqual(['gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'])
  })

  it('groups models with claude-3 prefix including version separator', () => {
    const result = groupModelsByLcp(['claude-3-opus', 'claude-3-sonnet'])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('claude-3')
  })

  it('groups text-embedding-3 prefix', () => {
    const result = groupModelsByLcp(['text-embedding-3-small', 'text-embedding-3-large'])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('text-embedding-3')
  })

  it('splits unrelated models into separate groups', () => {
    const result = groupModelsByLcp(['gpt-4o', 'claude-3-opus'])
    expect(result).toHaveLength(2)
    const names = result.map((g) => g.name).sort()
    expect(names).toEqual(['claude-3-opus', 'gpt-4o'])
  })

  it('treats underscore as separator', () => {
    const result = groupModelsByLcp(['text_gen_v1', 'text_gen_v2'])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('text_gen')
  })

  it('dedupes duplicate model ids within a group', () => {
    const result = groupModelsByLcp(['gpt-4o', 'gpt-4o', 'gpt-4o-mini'])
    expect(result).toHaveLength(1)
    expect(result[0].models).toHaveLength(2)
  })

  it('filters out empty and non-string entries', () => {
    const result = groupModelsByLcp(['', 'gpt-4o', '   ', 'gpt-4o-mini'])
    expect(result).toHaveLength(1)
    expect(result[0].models.map((m) => m.id)).toEqual(['gpt-4o', 'gpt-4o-mini'])
  })

  it('handles mixed prefix groups', () => {
    const result = groupModelsByLcp([
      'gpt-4o', 'gpt-3.5-turbo',
      'claude-3-opus', 'claude-3-sonnet',
      'dall-e-3',
    ])
    expect(result).toHaveLength(3)
    const names = result.map((g) => g.name).sort()
    expect(names).toEqual(['claude-3', 'dall-e-3', 'gpt'])
  })

  it('does not create single-char prefix group when prefix is too short', () => {
    // g 和 c 没有公共前缀,应各自成组
    const result = groupModelsByLcp(['gpt-4o', 'claude-3'])
    expect(result).toHaveLength(2)
  })
})
