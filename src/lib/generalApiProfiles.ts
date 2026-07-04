import type { GeneralApiProfile, GeneralApiMode, ModelGroup } from '../types'

export const DEFAULT_GENERAL_API_PROFILE_ID = 'default-general'
const DEFAULT_GENERAL_API_MODE: GeneralApiMode = 'chat'
const UNGROUPED_NAME = '__ungrouped__'

export function createDefaultGeneralApiProfile(overrides: Partial<GeneralApiProfile> = {}): GeneralApiProfile {
  return {
    id: DEFAULT_GENERAL_API_PROFILE_ID,
    name: '默认',
    baseUrl: '',
    apiKey: '',
    apiMode: DEFAULT_GENERAL_API_MODE,
    apiProxy: false,
    ...overrides,
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}

export function normalizeGeneralApiProfile(input: unknown): GeneralApiProfile {
  if (!isRecord(input)) return createDefaultGeneralApiProfile()

  const id = typeof input.id === 'string' && input.id.trim() ? input.id : DEFAULT_GENERAL_API_PROFILE_ID
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : (id === DEFAULT_GENERAL_API_PROFILE_ID ? '默认' : '新配置')
  const baseUrl = typeof input.baseUrl === 'string' ? input.baseUrl : ''
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey : ''
  const apiMode: GeneralApiMode = input.apiMode === 'responses' ? 'responses' : 'chat'
  const apiProxy = typeof input.apiProxy === 'boolean' ? input.apiProxy : false

  return { id, name, baseUrl, apiKey, apiMode, apiProxy }
}

export function normalizeGeneralApiProfiles(input: unknown): GeneralApiProfile[] {
  if (!Array.isArray(input) || input.length === 0) return [createDefaultGeneralApiProfile()]
  const profiles = input.map(normalizeGeneralApiProfile)
  return profiles.length ? profiles : [createDefaultGeneralApiProfile()]
}

export function normalizeModelGroup(input: unknown): ModelGroup | null {
  if (!isRecord(input)) return null
  const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : null
  const profileId = typeof input.profileId === 'string' && input.profileId.trim() ? input.profileId.trim() : null
  if (!id || !profileId) return null

  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : UNGROUPED_NAME
  const modelIds = Array.isArray(input.modelIds)
    ? input.modelIds.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : []
  const now = Date.now()
  const createdAt = typeof input.createdAt === 'number' && Number.isFinite(input.createdAt) ? input.createdAt : now
  const updatedAt = typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt) ? input.updatedAt : now

  return { id, name, profileId, modelIds, createdAt, updatedAt }
}

export function normalizeModelGroups(input: unknown): ModelGroup[] {
  if (!Array.isArray(input)) return []
  return input.map(normalizeModelGroup).filter((item): item is ModelGroup => item !== null)
}

export { UNGROUPED_NAME }
