import { NativeModules } from 'react-native'
import { addListMusics, createUserList, removeListMusics } from '@/core/list'
import listState from '@/store/list/state'
import { readMetadata } from '@/utils/localMediaMetadata'
import { getListMusics } from '@/utils/listManage'
import { requestStoragePermission } from '@/utils/tools'
import { formatPlayTime2 } from '@/utils/common'
import { getLocalScanExcluded } from '@/utils/data'

/**
 * 【车机改造】本地无损曲库：
 * - 基于 MediaStore 秒扫（内置存储 + U盘），不做全盘遍历
 * - 扫描结果落在一个固定 ID 的用户列表里，复用原有播放/歌词/封面全链路
 * - 增量同步：新文件加入、已删除文件移除
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

export const isLosslessExt = (ext: string) => LOSSLESS_EXTS.has(ext.toLowerCase())
export const getQualityBadge = (ext: string): 'SQ' | 'HQ' | null => {
  const e = ext.toLowerCase()
  if (LOSSLESS_EXTS.has(e)) return 'SQ'
  if (e === 'mp3' || e === 'aac' || e === 'm4a' || e === 'ogg' || e === 'opus') return 'HQ'
  return null
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

const buildMusicInfo = (item: ScannedAudioItem, metadata: Awaited<ReturnType<typeof readMetadata>>): LX.Music.MusicInfoLocal => {
  const index = item.path.lastIndexOf('.')
  const fileName = item.path.substring(item.path.lastIndexOf('/') + 1)
  const name = metadata?.name || item.title || decodeURIComponent(fileName.substring(0, index))
  const singer = metadata?.singer || item.artist || ''
  return {
    id: item.path,
    name,
    singer,
    source: 'local',
    interval: metadata?.interval ? formatPlayTime2(metadata.interval) : (item.duration > 0
      ? formatPlayTime2(item.duration)
      : null),
    meta: {
      albumName: metadata?.albumName || item.album || '',
      filePath: item.path,
      songId: item.path,
      picUrl: '',
      ext: fileName.substring(fileName.lastIndexOf('.') + 1),
    },
  }
}

/**
 * 扫描本地音乐并增量同步到「本地音乐」列表
 */
export const scanLocalMusic = async(): Promise<ScanResult> => {
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

  // 2. 与现有列表对比，增量更新
  const existing = await getListMusics(LOCAL_LIST_ID)
  const existingPaths = new Set(existing.map(getFilePathFromMusicInfo))
  const scannedPaths = new Set(items.map(i => i.path))

  const newItems = items.filter(i => !existingPaths.has(i.path))
  const removedIds = existing.filter(info => {
    return !scannedPaths.has(getFilePathFromMusicInfo(info))
  }).map(info => info.id)

  // 3. 读取新文件元数据（与原版添加本地歌曲相同方式，2 路并发）
  const added: LX.Music.MusicInfoLocal[] = []
  const queue = [...newItems]
  while (queue.length) {
    const batch = queue.splice(0, 4)
    const res = await Promise.all(batch.map(async item => {
      try {
        return [item, await readMetadata(item.path)] as const
      } catch {
        return [item, null] as const
      }
    }))
    for (const [item, metadata] of res) {
      if (metadata) added.push(buildMusicInfo(item, metadata))
      else added.push(buildMusicInfo(item, null))
    }
  }

  if (removedIds.length) await removeListMusics(LOCAL_LIST_ID, removedIds)
  if (added.length) await addListMusics(LOCAL_LIST_ID, added, 'bottom')

  return { added: added.length, removed: removedIds.length, total: existing.length + added.length - removedIds.length }
}

/**
 * 列表内展示用格式角标（SQ/HQ）
 */
export const getLocalQualityBadge = (info: LX.Music.MusicInfo): 'SQ' | 'HQ' | null => {
  if (info.source != 'local') return null
  return getQualityBadge((info as LX.Music.MusicInfoLocal).meta?.ext ?? '')
}
