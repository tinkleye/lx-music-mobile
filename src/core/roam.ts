import settingState from '@/store/setting/state'
import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import { getListMusics, getListMusicSync } from '@/utils/listManage'
import { overwriteListMusics } from '@/core/list'
import { playList, resetRandomNextMusicInfo } from '@/core/player/player'
import { isBlockedMusic, hasBlockRules } from '@/core/blockList'
import { getData, saveData } from '@/plugins/storage'
import { getRandom } from '@/utils/common'
import { toast } from '@/utils/tools'
import { LIST_IDS } from '@/config/constant'
import { LOCAL_LIST_ID } from '@/core/music/localLibrary'

/**
 * 【v42】歌曲漫游：无歌单随机播放。
 *
 * 曲池三级来源（离线优先）：
 *   1. 用户歌单聚合（全部列表去重，可勾选"不参与漫游的歌单"）；
 *   2. 在线榜单兜底（曲池为空时拉热歌榜）；
 *   3. 本地 U 盘音乐兜底（全离线可用）。
 *
 * 播放走临时隐藏队列（专用列表 ID），用户歌单零改动。
 * 抽取为加权随机：歌手频次画像（我喜欢 + 本轮已播）+ 三档风格浓度。
 */

export const ROAM_LIST_ID = 'roam_queue'
const ROAM_RECENT_KEY = '@roam_recent_ids'
const ROAM_STATE_KEY = '@roam_state'
const RECENT_LIMIT = 200
const POOL_SIZE = 30

/** 风格浓度：偏好歌曲占比 */
const MODE_RATIOS: Record<LX.AppSetting['roam.mode'], number> = {
  conservative: 0.8,
  balanced: 0.7,
  explorative: 0.5,
  radical: 0.2,
}

export interface RoamState {
  active: boolean
  /** 来源描述，如「来自 3 个歌单 · 共 520 首」/「热歌榜」/「本地音乐」 */
  sourceDesc: string
  poolSize: number
}

let state: RoamState = { active: false, sourceDesc: '', poolSize: 0 }
let recentIds: string[] = []
const singerSkipCounts = new Map<string, number>()
/** 本轮漫游中被降权的歌手 */
const roamExcludedSingers = new Set<string>()
const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) listener()
}

export const subscribeRoam = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getRoamState = (): RoamState => state

/** 漫游队列列表名（播放页队列标题用） */
export const getRoamListName = () => global.i18n.t('roam_list_name')

export const initRoam = async() => {
  try {
    const savedRecent = await getData<string[]>(ROAM_RECENT_KEY)
    if (Array.isArray(savedRecent)) recentIds = savedRecent.slice(-RECENT_LIMIT)
    const savedState = await getData<RoamState>(ROAM_STATE_KEY)
    // 恢复漫游标记但不自动续播：队列内容在 @roam_state 里一并保存，用户手动点播放即可
    if (savedState?.active && savedState.sourceDesc) {
      state = { ...savedState }
      // 队列歌曲在退出 App 前保存在 TEMP 存储的 roam_queue 列表里（overwriteListMusics 会持久化）
    }
  } catch (err) {
    console.log('init roam failed:', err)
  }
  notify()
}

const pushRecent = (id: string) => {
  recentIds = recentIds.filter(x => x != id)
  recentIds.push(id)
  if (recentIds.length > RECENT_LIMIT) recentIds = recentIds.slice(-RECENT_LIMIT)
  void saveData(ROAM_RECENT_KEY, recentIds).catch(() => {})
}

/**
 * 构建曲池：聚合全部参与漫游的列表，去重 + 过滤屏蔽规则。
 */
const buildPool = async(): Promise<{ pool: LX.Music.MusicInfo[], listCount: number }> => {
  const excluded: string[] = settingState.setting['roam.excludedLists'] ?? []
  const listIds: string[] = []
  // 内置列表：默认 + 收藏（收藏权重体现在画像里，这里平等进池）
  listIds.push(LIST_IDS.DEFAULT, LIST_IDS.LOVE)
  for (const list of listState.userList) listIds.push(list.id)

  const seen = new Set<string>()
  const pool: LX.Music.MusicInfo[] = []
  let usedLists = 0
  for (const listId of listIds) {
    if (excluded.includes(listId)) continue
    const musics = getListMusicSync(listId).length ? getListMusicSync(listId) : await getListMusics(listId)
    if (!musics.length) continue
    usedLists++
    for (const m of musics) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      if (hasBlockRules() && isBlockedMusic(m)) continue
      pool.push(m)
    }
  }
  return { pool, listCount: usedLists }
}

/**
 * 歌手频次画像：「我喜欢」列表 + 本轮会话已播放记录。
 * 返回 歌手名 -> 出现次数（小写归一）。
 */
const buildSingerProfile = (): Map<string, number> => {
  const profile = new Map<string, number>()
  const bump = (singer: string) => {
    const key = (singer ?? '').trim().toLowerCase()
    if (!key) return
    profile.set(key, (profile.get(key) ?? 0) + 1)
  }
  for (const m of getListMusicSync(LIST_IDS.LOVE)) bump(m.singer)
  for (const p of playerState.playedList) {
    if ('progress' in p.musicInfo) continue
    bump(p.musicInfo.singer)
  }
  return profile
}

/** 本地音乐兜底（U 盘曲库） */
const buildLocalPool = async(): Promise<LX.Music.MusicInfo[]> => {
  const { getListMusics } = await import('@/utils/listManage')
  const list = await getListMusics(LOCAL_LIST_ID)
  return list.filter(m => !isBlockedMusic(m))
}

/**
 * 加权抽取：偏好占比按档位（conservative 80% / balanced 70% / explorative 50%）。
 */
const pickFromPool = (pool: LX.Music.MusicInfo[], count: number): LX.Music.MusicInfo[] => {
  const mode: LX.AppSetting['roam.mode'] = settingState.setting['roam.mode'] ?? 'balanced'
  const ratio = MODE_RATIOS[mode] ?? 0.7
  const profile = buildSingerProfile()

  // 偏好子集：画像歌手（排除本轮降权歌手）+ 我收藏的歌
  const loveIds = new Set(getListMusicSync(LIST_IDS.LOVE).map(m => m.id))
  const isPreferred = (m: LX.Music.MusicInfo) => {
    if (loveIds.has(m.id)) return true
    const key = (m.singer ?? '').trim().toLowerCase()
    return !!key && profile.has(key) && !roamExcludedSingers.has(key)
  }

  const candidates = pool.filter(m => {
    const key = (m.singer ?? '').trim().toLowerCase()
    return !key || !roamExcludedSingers.has(key)
  })
  if (!candidates.length) return []

  const recentSet = new Set(recentIds)
  const fresh = candidates.filter(m => !recentSet.has(m.id))
  const pickFrom = fresh.length >= count ? fresh : candidates

  const result: LX.Music.MusicInfo[] = []
  const used = new Set<string>()
  let preferredPicked = 0
  for (let i = 0; i < count && used.size < pickFrom.length; i++) {
    const wantPreferred = result.length == 0 || (preferredPicked / result.length) < ratio
    const subset = wantPreferred ? pickFrom.filter(m => isPreferred(m) && !used.has(m.id)) : []
    const fallback = pickFrom.filter(m => !used.has(m.id))
    const source = subset.length ? subset : fallback
    if (!source.length) break
    const pick = source[getRandom(0, source.length)]
    used.add(pick.id)
    if (isPreferred(pick)) preferredPicked++
    result.push(pick)
  }
  return result
}

/**
 * 开始漫游 / 换一批。
 * @param forceLocalListId 本地音乐兜底曲池（可选，避免 roam 内部再依赖扫描模块）
 */
export const startRoam = async(options?: { localPool?: LX.Music.MusicInfo[] }) => {
  let { pool, listCount } = await buildPool()
  let sourceDesc = global.i18n.t('roam_source_playlists', { count: listCount, total: pool.length })

  if (pool.length < 10) {
    // 在线榜单兜底
    try {
      const boardPool = await fetchBoardPool()
      if (boardPool.length > pool.length) {
        pool = boardPool
        sourceDesc = global.i18n.t('roam_source_board')
      }
    } catch (err) {
      console.log('roam board fallback failed:', err)
    }
  }
  if (pool.length < 10 && options?.localPool?.length) {
    pool = options.localPool
    sourceDesc = global.i18n.t('roam_source_local')
  }
  if (!pool.length) {
    toast(global.i18n.t('roam_pool_empty'))
    return
  }

  const picked = pickFromPool(pool, Math.min(POOL_SIZE, pool.length))
  if (!picked.length) {
    toast(global.i18n.t('roam_pool_empty'))
    return
  }

  await overwriteListMusics(ROAM_LIST_ID, picked)
  state = {
    active: true,
    sourceDesc,
    poolSize: pool.length,
  }
  void saveData(ROAM_STATE_KEY, state).catch(() => {})

  // 随机起播
  resetRandomNextMusicInfo()
  const startIndex = getRandom(0, picked.length)
  await playList(ROAM_LIST_ID, startIndex)
  pushRecent(picked[startIndex].id)
  toast(global.i18n.t('roam_started', { count: picked.length }))
  notify()
}

/** 换一批：重建队列并随机换歌（保持漫游态） */
export const nextRoamBatch = async() => {
  if (!state.active) return startRoam()
  return startRoam()
}

/** 不想听：跳歌并做负反馈（同歌手累计 3 次本轮降权） */
export const dislikeRoamCurrent = async() => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (musicInfo && !('progress' in musicInfo)) {
    pushRecent(musicInfo.id)
    const key = (musicInfo.singer ?? '').trim().toLowerCase()
    if (key) {
      const count = (singerSkipCounts.get(key) ?? 0) + 1
      singerSkipCounts.set(key, count)
      if (count >= 3) {
        roamExcludedSingers.add(key)
        toast(global.i18n.t('roam_singer_muted', { singer: musicInfo.singer }))
      }
    }
  }
}

export const endRoam = async() => {
  state = { active: false, sourceDesc: '', poolSize: 0 }
  singerSkipCounts.clear()
  roamExcludedSingers.clear()
  await saveData(ROAM_STATE_KEY, state).catch(() => {})
  notify()
}

/** 在线榜单兜底曲池（复用排行榜 core，取默认源的第一个榜单全量） */
const fetchBoardPool = async(): Promise<LX.Music.MusicInfo[]> => {
  const { getBoardsList, getListDetailAll } = await import('@/core/leaderboard')
  const boards = await getBoardsList('kw')
  const first = boards[0]
  if (!first) return []
  const list = await getListDetailAll(first.id)
  return list.filter(m => !isBlockedMusic(m))
}

/** 播放列表页显示用：当前是否漫游队列 */
export const isRoamList = (listId: string | null) => listId == ROAM_LIST_ID
