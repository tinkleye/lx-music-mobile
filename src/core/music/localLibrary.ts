import { NativeModules } from 'react-native'
import { addListMusics, createUserList, removeListMusics } from '@/core/list'
import listState from '@/store/list/state'
import { readMetadata } from '@/utils/localMediaMetadata'
import { getListMusics } from '@/utils/listManage'
import { requestStoragePermission } from '@/utils/tools'
import { getData, saveData } from '@/plugins/storage'
import { formatPlayTime2 } from '@/utils/common'
import { getLocalScanExcluded } from '@/utils/data'

/**
 * 【车机改造】本地无损曲库：
 * - 基于 MediaStore 秒扫（内置存储 + U盘），不做全盘遍历
 * - 扫描结果落在一个固定 ID 的用户列表里，复用原有播放/歌词/封面全链路
 * - 增量同步：新文件加入、已删除文件移除
 * 【v40】三大增强：
 * - 元数据缓存：扫描结果（歌名/歌手/专辑/时长）落库，重扫只对真正的新文件读标签，
 *   U盘拔插后的重扫从"几分钟"降到"几秒"
 * - 脏数据防御：部分 ROM 对无标签文件把整个路径填进 MediaStore 的 album 字段，
 *   形似路径/带音频扩展名的专辑名一律判脏置空（显示为"未知专辑"）
 * - U盘拔出保留：拔出 U 盘后其文件不参与"已删除"判定，列表保留；重新插入自动增量合并
 */

export const LOCAL_LIST_ID = 'local_music'
export const LOCAL_LIST_NAME_KEY = 'local_music_list_name'

// 无损扩展名 → SQ 角标；其余可播格式不标记
const LOSSLESS_EXTS = new Set(['flac', 'wav', 'ape', 'dsf', 'dff', 'wv', 'tta', 'alac'])
const SUPPORTED_EXTS = new Set([...LOSSLESS_EXTS, 'mp3', 'm4a', 'aac', 'ogg', 'opus'])

interface ScannedAudioItem {
  path: string
  title: string
  artist: string
  album: string
  duration: number
  size: number
  mime: string
}

export type ScanResult = {
  err?: 'permission'
  added: number
  removed: number
  total: number
}

export type ScanProgress = {
  stage: 'probing' | 'reading' | 'saving' | 'done' | 'empty' | 'error'
  /** probing: MediaStore 已发现数量；reading: 已处理/总数；done: 最终总数 */
  found?: number
  current?: number
  total?: number
  added?: number
  removed?: number
}

export const isLosslessExt = (ext: string) => LOSSLESS_EXTS.has(ext.toLowerCase())
export const getQualityBadge = (ext: string): 'SQ' | 'HQ' | null => {
  const e = ext.toLowerCase()
  if (LOSSLESS_EXTS.has(e)) return 'SQ'
  if (e === 'mp3' || e === 'aac' || e === 'm4a' || e === 'ogg' || e === 'opus') return 'HQ'
  return null
}

// ==================== 【v40】脏专辑名过滤 ====================

const AUDIO_EXT_RE = /\.(mp3|flac|wav|ape|m4a|aac|ogg|opus|dsf|dff|wv|tta|alac)$/i

/**
 * 部分车机 ROM 对无标签文件会把「完整路径」或「文件名」填进 MediaStore 的
 * album 字段。形似路径（含 / 或 \）或以音频扩展名结尾的专辑名一律判脏置空，
 * GroupView 会自动显示为「未知专辑」。
 */
export const sanitizeAlbumName = (album: string): string => {
  const trimmed = (album ?? '').trim()
  if (!trimmed) return ''
  if (trimmed.includes('/') || trimmed.includes('\\')) return ''
  if (AUDIO_EXT_RE.test(trimmed)) return ''
  // 整段就是文件名（去扩展名后与专辑名相同也无所谓，交给路径判断兜底）
  return trimmed
}

/**
 * 【v40】无标签文件按「歌名 - 歌手」文件名惯例拆分歌名与歌手。
 * 仅在歌手信息缺失时启用，避免对正常标签二次拆分。
 * 例：`忘不了您 - 谭咏麟.flac` → { name: '忘不了您', singer: '谭咏麟' }
 */
export const parseNameFromFileName = (fileName: string): { name: string, singer: string } => {
  const base = fileName.replace(AUDIO_EXT_RE, '').trim()
  // 最多按第一个 " - " 拆一次：第一段=歌名，第二段=歌手
  const idx = base.indexOf(' - ')
  if (idx <= 0 || idx >= base.length - 3) return { name: base, singer: '' }
  const name = base.substring(0, idx).trim()
  const singer = base.substring(idx + 3).trim()
  if (!name || !singer) return { name: base, singer: '' }
  return { name, singer }
}

// ==================== 【v40】元数据缓存 ====================

const META_CACHE_KEY = '@local_meta_cache'

/** 缓存条目字段与 MusicMetadata 的子集保持同名，buildMusicInfo 可直接消费 */
type MetaCacheEntry = {
  name: string
  singer: string
  albumName: string
  interval: number
}

const getMetaCache = async(): Promise<Record<string, MetaCacheEntry>> => {
  return await getData<Record<string, MetaCacheEntry>>(META_CACHE_KEY) ?? {}
}

const saveMetaCache = async(cache: Record<string, MetaCacheEntry>) => {
  await saveData(META_CACHE_KEY, cache)
}

const getFilePathFromMusicInfo = (info: LX.Music.MusicInfo): string => {
  return (info as LX.Music.MusicInfoLocal).meta?.filePath ?? info.id
}

/**
 * 确保内置「本地音乐」列表存在（固定 ID，避免重复创建）
 */
export const ensureLocalList = async(): Promise<string> => {
  const exists = listState.userList.some(l => l.id === LOCAL_LIST_ID)
  if (!exists) {
    await createUserList(listState.userList.length, [{
      id: LOCAL_LIST_ID,
      name: global.i18n.t(LOCAL_LIST_NAME_KEY),
      locationUpdateTime: null,
    }])
  }
  return LOCAL_LIST_ID
}

type MetadataLike = { name?: string, singer?: string, albumName?: string, interval?: number } | null

const buildMusicInfo = (item: ScannedAudioItem, metadata: MetadataLike): LX.Music.MusicInfoLocal => {
  const index = item.path.lastIndexOf('.')
  const fileName = item.path.substring(item.path.lastIndexOf('/') + 1)
  // 【v55】文件名可能含 % 等非法 URI 编码（如「100% 完美.mp3」），decodeURIComponent
  // 会抛 URIError，导致整个扫描中断误报「扫描失败」；解码失败就保留原始文件名
  let fileNameBase = fileName.substring(0, index)
  try {
    fileNameBase = decodeURIComponent(fileNameBase)
  } catch {
    // 保留原始文件名
  }
  let name = metadata?.name || item.title || fileNameBase
  let singer = metadata?.singer || item.artist || ''
  // 【v40】歌手信息缺失时按「歌名 - 歌手」文件名惯例拆分（车机 U 盘常见命名）
  if (!singer) {
    const parsed = parseNameFromFileName(fileNameBase)
    // 标签里已有歌名时不覆盖，只补歌手
    if (parsed.singer) {
      if (!metadata?.name && !item.title) name = parsed.name
      singer = parsed.singer
    }
  }
  return {
    id: item.path,
    name,
    singer,
    source: 'local',
    interval: metadata?.interval ? formatPlayTime2(metadata.interval) : (item.duration > 0
      ? formatPlayTime2(item.duration)
      : null),
    meta: {
      albumName: sanitizeAlbumName(metadata?.albumName || item.album || ''),
      filePath: item.path,
      songId: item.path,
      picUrl: '',
      ext: fileName.substring(fileName.lastIndexOf('.') + 1),
    },
  }
}

/**
 * 【v40】清洗已入库的脏专辑名（旧版本入库的"路径型专辑名"）。
 * 返回需要重建的路径集合（调用方把这些路径从"已存在"集合中剔除，让它们
 * 走正常的新增流程，用缓存/标签重建出干净的条目）。
 */
const findDirtyEntries = (existing: LX.Music.MusicInfo[]): Set<string> => {
  const dirty = new Set<string>()
  for (const info of existing) {
    if (info.source != 'local') continue
    const albumName = (info as LX.Music.MusicInfoLocal).meta?.albumName ?? ''
    if (albumName && sanitizeAlbumName(albumName) == '') {
      dirty.add(getFilePathFromMusicInfo(info))
    }
  }
  return dirty
}

/**
 * 扫描本地音乐并增量同步到「本地音乐」列表
 * 【v40】onProgress：全程进度回调，供列表页状态条展示
 */
export const scanLocalMusic = async(onProgress?: (p: ScanProgress) => void): Promise<ScanResult> => {
  const isGranted = await requestStoragePermission().catch(() => false)
  if (!isGranted) return { err: 'permission', added: 0, removed: 0, total: 0 }

  await ensureLocalList()

  // 1. MediaStore 秒扫
  // 【v34】扫描排除列表（黑名单）：默认全部扫描，用户在文件夹选择器中取消勾选的文件夹
  // 不参与扫描。排除列表之外的文件夹（含以后新出现的）默认都会收录。
  // 【v36】排除即移除：已在列表中但位于排除文件夹内的歌曲，重新扫描时一并移除，
  // 让取消勾选立即在歌单上生效（文件本身不动，重新勾选再扫一次即可恢复）。
  const excludedFolders = (await getLocalScanExcluded()).map(f => f.endsWith('/') ? f : `${f}/`)
  const inScope = (p: string) => !excludedFolders.some(f => p.startsWith(f))

  const raw: ScannedAudioItem[] = await NativeModules.MediaScannerModule.scanAudio()
  const items = raw.filter(item => {
    const ext = item.path.substring(item.path.lastIndexOf('.') + 1).toLowerCase()
    return SUPPORTED_EXTS.has(ext) && inScope(item.path)
  })
  onProgress?.({ stage: 'probing', found: items.length })

  // 【v40】当前已挂载的存储卷根路径：U 盘拔出后其文件不属于任何挂载卷，
  // 不参与「已删除」判定（列表保留），重新插入后增量合并
  let mountedRoots: string[] = []
  try {
    mountedRoots = await NativeModules.MediaScannerModule.getMountedRoots()
  } catch {}
  const isOnMountedVolume = (p: string) => mountedRoots.some(root => p.startsWith(root))

  // 2. 与现有列表对比，增量更新
  const existing = await getListMusics(LOCAL_LIST_ID)
  const dirtyPaths = findDirtyEntries(existing)
  const existingPaths = new Set(existing.map(getFilePathFromMusicInfo))
  const scannedPaths = new Set(items.map(i => i.path))

  const newItems = items.filter(i => !existingPaths.has(i.path) || dirtyPaths.has(i.path))
  const removedIds = existing.filter(info => {
    const path = getFilePathFromMusicInfo(info)
    // 脏数据条目一律重建（从列表移除后随新流程加回）
    if (dirtyPaths.has(path)) return true
    // 【v40】文件已不在扫描结果里，且它所在的存储卷当前已挂载 → 真的被删了，移除。
    // 卷未挂载（U盘拔出）→ 保留条目
    if (scannedPaths.has(path)) return false
    return isOnMountedVolume(path)
  }).map(info => info.id)

  // 3. 读取新文件元数据：【v40】先查缓存，未命中才真正读标签（4 路并发）
  const metaCache = await getMetaCache()
  const newCacheEntries: Record<string, MetaCacheEntry> = {}

  const added: LX.Music.MusicInfoLocal[] = []
  const queue = [...newItems]
  const total = queue.length
  let current = 0
  onProgress?.({ stage: 'reading', current: 0, total })

  while (queue.length) {
    const batch = queue.splice(0, 4)
    const res = await Promise.all(batch.map(async item => {
      const cached = metaCache[item.path]
      if (cached) return [item, cached as MetadataLike, true] as const
      try {
        return [item, await readMetadata(item.path) as MetadataLike, false] as const
      } catch {
        return [item, null, false] as const
      }
    }))
    for (const [item, metadata, fromCache] of res) {
      current++
      onProgress?.({ stage: 'reading', current, total })
      added.push(buildMusicInfo(item, metadata))
      if (!fromCache) {
        // 写入缓存：下次重扫（U盘拔插）直接命中，不再读标签
        newCacheEntries[item.path] = {
          name: metadata?.name ?? '',
          singer: metadata?.singer ?? '',
          albumName: sanitizeAlbumName(metadata?.albumName ?? ''),
          interval: metadata?.interval ?? 0,
        }
      }
    }
  }

  if (Object.keys(newCacheEntries).length) {
    await saveMetaCache({ ...metaCache, ...newCacheEntries })
  }

  onProgress?.({ stage: 'saving', found: items.length })

  if (removedIds.length) await removeListMusics(LOCAL_LIST_ID, removedIds)
  if (added.length) await addListMusics(LOCAL_LIST_ID, added, 'bottom')

  const result: ScanResult = { added: added.length, removed: removedIds.length, total: existing.length + added.length - removedIds.length }
  onProgress?.({
    stage: items.length ? 'done' : 'empty',
    added: result.added,
    removed: result.removed,
    total: result.total,
  })
  return result
}

/**
 * 列表内展示用格式角标（SQ/HQ）
 */
export const getLocalQualityBadge = (info: LX.Music.MusicInfo): 'SQ' | 'HQ' | null => {
  if (info.source != 'local') return null
  return getQualityBadge((info as LX.Music.MusicInfoLocal).meta?.ext ?? '')
}
