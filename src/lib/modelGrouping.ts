import type { CandidateGroup, CandidateModel } from '../types'

const SEPARATORS = /[-_]/

/**
 * 计算多个字符串的最长公有前缀(按 - 和 _ 分隔的 token 级别)
 * 返回 token 数组(不含分隔符),例如 ['gpt']、['claude', '3']
 */
function longestCommonPrefixTokens(ids: string[]): string[] {
  if (ids.length === 0) return []
  const tokenLists = ids.map((id) => id.split(SEPARATORS))
  const first = tokenLists[0]
  const prefix: string[] = []

  for (let i = 0; i < first.length; i++) {
    const token = first[i]
    if (tokenLists.every((tokens) => tokens[i] === token)) {
      prefix.push(token)
    } else {
      break
    }
  }
  return prefix
}

/** 把 token 数组拼回原始前缀字符串,自动判断分隔符 */
function tokensToPrefix(tokens: string[], sampleId: string): string {
  if (tokens.length === 0) return ''
  let result = tokens[0]
  let searchFrom = result.length
  for (let i = 1; i < tokens.length; i++) {
    const nextSep = sampleId.slice(searchFrom).match(/^[-_]/)
    if (nextSep) {
      result += nextSep[0] + tokens[i]
      searchFrom += nextSep[0].length + tokens[i].length
    } else {
      result += tokens[i]
      searchFrom += tokens[i].length
    }
  }
  return result
}

/**
 * 按最长公有前缀对所有模型 ID 分组。
 *
 * 关键性质:两个模型 ID 若在 token 级别存在公共前缀,首 token 必然相同;
 * 反之首 token 不同则毫无公共前缀。因此先按首 token 聚类,
 * 再以每个聚类内成员的 LCP 作为分组名。首 token 唯一的模型各自成组(组名 = 模型 ID)。
 */
export function groupModelsByLcp(input: unknown): CandidateGroup[] {
  if (!Array.isArray(input)) return []

  // 清洗:去重、去空白、保序
  const seen = new Set<string>()
  const modelIds: string[] = []
  for (const item of input) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    modelIds.push(trimmed)
  }

  if (modelIds.length === 0) return []
  if (modelIds.length === 1) {
    return [{ name: modelIds[0], models: [{ id: modelIds[0] }] }]
  }

  // 按首 token 分桶,保留首次出现顺序以保证输出稳定
  const buckets = new Map<string, string[]>()
  const bucketOrder: string[] = []
  for (const id of modelIds) {
    const firstToken = id.split(SEPARATORS)[0]
    if (!buckets.has(firstToken)) {
      buckets.set(firstToken, [])
      bucketOrder.push(firstToken)
    }
    buckets.get(firstToken)!.push(id)
  }

  const groups: CandidateGroup[] = []
  for (const token of bucketOrder) {
    const members = buckets.get(token)!
    if (members.length === 1) {
      // 首 token 唯一,该模型无同伴,自成一组
      const id = members[0]
      groups.push({ name: id, models: [{ id }] })
    } else {
      // 以聚类成员的 LCP 作为分组名
      const lcpTokens = longestCommonPrefixTokens(members)
      const name = tokensToPrefix(lcpTokens, members[0])
      groups.push({
        name,
        models: members.map((id) => ({ id }) as CandidateModel),
      })
    }
  }

  return groups
}
