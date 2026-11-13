import { getData, saveData } from '@/plugins/storage'

/**
 * 【v42】歌曲屏蔽：屏蔽的歌手 / 屏蔽的歌名关键词。
 *
 * 与原版「不喜欢」（歌名+歌手精确配对）是两套独立规则：
 * - 歌手、关键词按「包含」判断：歌曲歌手名或歌名中含有规则内容即命中，
 *   因此含该歌手的合唱歌曲也会一并被屏蔽；
 * - 规则不足 2 个字时按「完全相同」判断，避免屏蔽范围过大。
 *
 * 被屏蔽的歌曲：自动切歌时不会选中（filterList 前置过滤）；
 * 手动点播被屏蔽歌曲时自动切到下一首可播放歌曲；歌单内容不会被删除。
 */

const BLOCK_RULES_KEY = '@block_rules'

export interface BlockRules {
  singers: string[]
  keywords: string[]
}

let rules: BlockRules = { singers: [], keywords: [] }
const listeners = new Set<() => void>()

const normalize = (rule: string) => rule.trim().toLowerCase()

/** 规则不足 2 个字时按完全相同判断 */
const matches = (value: string, rule: string) => {
  const v = normalize(value)
  const r = normalize(rule)
  if (!r) return false
  if (r.length < 2) return v === r
  return v.includes(r)
}

export const isSingerBlocked = (singer: string) => {
  if (!singer) return false
  return rules.singers.some(rule => matches(singer, rule))
}

export const isNameBlocked = (name: string) => {
  if (!name) return false
  return rules.keywords.some(rule => matches(name, rule))
}

export const isBlockedMusic = (musicInfo: { name?: string, singer?: string } | null | undefined) => {
  if (!musicInfo) return false
  return isSingerBlocked(musicInfo.singer ?? '') || isNameBlocked(musicInfo.name ?? '')
}

/** 是否配置了屏蔽规则（供播放链路快速短路） */
export const hasBlockRules = () => {
  return rules.singers.length > 0 || rules.keywords.length > 0
}

export const getBlockRules = (): BlockRules => rules

const notify = () => {
  for (const listener of listeners) listener()
}

export const subscribeBlockRules = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const saveBlockRules = async(next: BlockRules) => {
  rules = {
    singers: next.singers.map(s => s.trim()).filter(Boolean),
    keywords: next.keywords.map(s => s.trim()).filter(Boolean),
  }
  await saveData(BLOCK_RULES_KEY, rules)
  notify()
}

export const addBlockSinger = async(singer: string) => {
  const value = singer.trim()
  if (!value) return
  if (rules.singers.some(s => normalize(s) == normalize(value))) return
  await saveBlockRules({ ...rules, singers: [...rules.singers, value] })
}

export const initBlockRules = async() => {
  const saved = await getData<BlockRules>(BLOCK_RULES_KEY)
  if (saved) {
    rules = {
      singers: Array.isArray(saved.singers) ? saved.singers : [],
      keywords: Array.isArray(saved.keywords) ? saved.keywords : [],
    }
  }
}

/** 批量编辑用：把原始文本解析成规则（每行一条，「歌手:xxx」/「关键词:xxx」，无前缀时两头都试） */
export const parseBlockRulesText = (text: string): BlockRules => {
  const singers: string[] = []
  const keywords: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const match = /^(歌手|关键词|关键字)\s*[:：]\s*(.+)$/.exec(line)
    if (match) {
      if (match[1] == '歌手') singers.push(match[2].trim())
      else keywords.push(match[2].trim())
      continue
    }
    // 无前缀：交给两个列表里更合适的一边（都不强判，放关键词）
    keywords.push(line)
  }
  return { singers, keywords }
}

export const buildBlockRulesText = (r: BlockRules) => {
  return [
    ...r.singers.map(s => `歌手:${s}`),
    ...r.keywords.map(k => `关键词:${k}`),
  ].join('\n')
}
