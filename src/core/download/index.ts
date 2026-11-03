import RNFS from 'react-native-fs'
import { getMusicUrl } from '@/core/music'
import settingState from '@/store/setting/state'

/**
 * 【车机改造】歌曲下载。
 *
 * 原版移动端把桌面端的下载模块整个裁掉了（core/music/download.ts 只剩空壳），
 * 但车机经常没网 / 流量贵，把喜欢的歌存到本机是很实际的需求，所以这里补一个
 * 轻量下载器：取到一个直链 → 用 react-native-fs 落盘 → 回调进度。
 *
 * 不做下载队列、断点续传、下载管理页，保持「点一下、选音质、等进度、
 * 完成提示」这一条最短路径。批量下载由上层逐首串行调用。
 */

/** 音质从高到低，下载页按这个顺序展示 */
export const QUALITY_ORDER: LX.Quality[] = ['flac24bit', 'flac', 'wav', 'ape', '320k', '192k', '128k']

/** 下载目录名，落在公共音乐目录下，方便车机自带的播放器也能扫到 */
const DOWNLOAD_DIR_NAME = 'LX音乐'

export interface DownloadQuality {
  quality: LX.Quality
  /** 展示用名称，如 FLAC / 320k */
  label: string
  /** 音源给出的体积描述，如 3.56M，可能为空 */
  size: string | null
  /** 体积换算成字节，用于进度估算，未知为 0 */
  sizeBytes: number
}

export interface DownloadProgress {
  /** 已下载字节 */
  loaded: number
  /** 文件总字节，未知时为 0 */
  total: number
}

export interface DownloadResult {
  filePath: string
  fileName: string
  /** 是否落在公共目录（false 表示退到 App 私有目录） */
  isPublic: boolean
}

export class DownloadCanceledError extends Error {
  constructor() {
    super('canceled')
    this.name = 'DownloadCanceledError'
  }
}

export const getQualityLabel = (quality: LX.Quality) => {
  switch (quality) {
    case 'flac24bit': return 'FLAC 24bit'
    case 'flac': return 'FLAC'
    case 'wav': return 'WAV'
    case 'ape': return 'APE'
    case '320k': return '320k'
    case '192k': return '192k'
    case '128k': return '128k'
    default: return quality
  }
}

/** 把 "3.56M" 这种描述换算成字节 */
const parseSize = (size?: string | null) => {
  if (!size) return 0
  const match = /^([\d.]+)\s*([kmg])?b?$/i.exec(size.trim())
  if (!match) return 0
  const num = parseFloat(match[1])
  if (isNaN(num)) return 0
  switch ((match[2] ?? '').toLowerCase()) {
    case 'k': return Math.round(num * 1024)
    case 'm': return Math.round(num * 1024 * 1024)
    case 'g': return Math.round(num * 1024 * 1024 * 1024)
    default: return Math.round(num)
  }
}

/**
 * 列出这首歌能下载的音质。
 *
 * 两个条件同时满足才可选：
 *   1. 歌曲本身带这个音质（meta._qualitys）；
 *   2. 当前在线音源声明支持这个音质（global.lx.qualityList[source]）。
 * 音源没声明（自定义源未定义 qualitys）时不做第二层过滤，交给取址结果判定。
 */
export const getDownloadQualitys = (musicInfo: LX.Music.MusicInfo): DownloadQuality[] => {
  // 本地歌曲没有在线音质概念
  if (musicInfo.source == 'local') return []
  const qualitys = (musicInfo.meta as Partial<LX.Music.MusicInfoMeta_online>)?._qualitys ?? {}
  const sizeMap: Partial<Record<LX.Quality, string | null>> = {}
  for (const item of ((musicInfo.meta as Partial<LX.Music.MusicInfoMeta_online>)?.qualitys ?? [])) {
    sizeMap[item.type] = item.size
  }
  const supported = global.lx.qualityList?.[musicInfo.source as LX.Source] as LX.Quality[] | undefined

  // 【车机改造】导入/同步的歌单里歌曲 meta 可能被裁掉 _qualitys，
  // 此时退而求其次：只要音源声明支持就列出来，能不能下交给取址结果判定
  const hasQualityMeta = Object.keys(qualitys).length > 0

  return QUALITY_ORDER.filter((quality) => {
    if (!hasQualityMeta && !(supported?.length)) return false
    if (hasQualityMeta && !qualitys[quality]) return false
    if (supported?.length && !supported.includes(quality)) return false
    return true
  }).map(quality => {
    const size = sizeMap[quality] ?? null
    return {
      quality,
      label: getQualityLabel(quality),
      size,
      sizeBytes: parseSize(size),
    }
  })
}

const getDirCandidates = () => [
  // 车机自带播放器一般会扫 Music 目录，优先放这里
  `${RNFS.ExternalStorageDirectoryPath}/Music/${DOWNLOAD_DIR_NAME}`,
  `${RNFS.DownloadDirectoryPath}/${DOWNLOAD_DIR_NAME}`,
  // 兜底：App 私有外部目录（Android 11+ 公共目录写不进去时用）
  `${RNFS.ExternalDirectoryPath}/${DOWNLOAD_DIR_NAME}`,
]

export const getDownloadDir = () => getDirCandidates()[0]

const prepareDownloadDir = async(): Promise<{ dir: string, isPublic: boolean }> => {
  const dirs = getDirCandidates()
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i]
    try {
      if (!await RNFS.exists(dir)) await RNFS.mkdir(dir)
      // 真写一个探针文件，只有真正可写才算成功
      const probe = `${dir}/.lx_write_test`
      await RNFS.writeFile(probe, 'ok', 'utf8')
      await RNFS.unlink(probe)
      return { dir, isPublic: i < dirs.length - 1 }
    } catch (err) {
      console.log('download dir not writable:', dir, err)
    }
  }
  throw new Error('no writable dir')
}

const sanitizeFileName = (name: string) => {
  return name
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || '未命名'
}

const URL_EXT_RE = /\.(mp3|flac|m4a|aac|ogg|opus|wav|ape|wma|mp4)(?![a-z0-9])/i

/** 从直链里猜扩展名，猜不出来就按音质给默认值 */
const getExtFromUrl = (url: string, quality: LX.Quality) => {
  const path = url.split('#')[0].split('?')[0]
  const match = URL_EXT_RE.exec(path)
  if (match) return match[1].toLowerCase()
  switch (quality) {
    case 'flac':
    case 'flac24bit':
      return 'flac'
    case 'wav':
      return 'wav'
    case 'ape':
      return 'ape'
    default:
      return 'mp3'
  }
}

const ensureUniquePath = async(path: string) => {
  if (!await RNFS.exists(path)) return path
  const dot = path.lastIndexOf('.')
  const base = dot > 0 ? path.slice(0, dot) : path
  const ext = dot > 0 ? path.slice(dot) : ''
  for (let i = 1; i < 100; i++) {
    const target = `${base}(${i})${ext}`
    if (!await RNFS.exists(target)) return target
  }
  return `${base}(${Date.now()})${ext}`
}

export interface DownloadTaskHandle {
  promise: Promise<DownloadResult>
  cancel: () => void
}

/**
 * 开始一首歌的下载。cancel() 会中断网络请求并删掉下了一半的文件。
 */
export const startDownload = ({ musicInfo, quality, onProgress }: {
  musicInfo: LX.Music.MusicInfo
  quality: LX.Quality
  onProgress?: (progress: DownloadProgress) => void
}): DownloadTaskHandle => {
  let jobId: number | null = null
  let canceled = false
  let destPath = ''
  let destIsPublic = true

  const promise = (async(): Promise<DownloadResult> => {
    const { dir, isPublic } = await prepareDownloadDir()
    destIsPublic = isPublic
    if (canceled) throw new DownloadCanceledError()

    // 直链会过期，这里强制重新取一次，不复用缓存
    const url = await getMusicUrl({ musicInfo, quality, isRefresh: true })
    if (!url) throw new Error('empty url')
    if (canceled) throw new DownloadCanceledError()

    // 与桌面版下载的命名设置保持一致：歌名 - 歌手 / 歌手 - 歌名 / 歌名
    const baseName = sanitizeFileName(
      settingState.setting['download.fileName']
        .replace('歌手', musicInfo.singer ?? '')
        .replace('歌名', musicInfo.name),
    )
    const ext = getExtFromUrl(url, quality)
    const fileName = `${baseName}.${ext}`
    destPath = await ensureUniquePath(`${dir}/${fileName}`)

    const expected = getDownloadQualitys(musicInfo).find(q => q.quality == quality)?.sizeBytes ?? 0
    const task = RNFS.downloadFile({
      fromUrl: url,
      toFile: destPath,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Mobile Safari/537.36',
      },
      progressInterval: 300,
      progress: (res) => {
        onProgress?.({
          loaded: res.bytesWritten,
          total: res.contentLength > 0 ? res.contentLength : expected,
        })
      },
    })
    jobId = task.jobId

    const res = await task.promise
    jobId = null
    if (canceled) {
      await RNFS.unlink(destPath).catch(() => {})
      throw new DownloadCanceledError()
    }
    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
      await RNFS.unlink(destPath).catch(() => {})
      throw new Error(`HTTP ${res.statusCode}`)
    }
    // 部分音源失败时会返回一个很小的错误页/空文件
    const stat = await RNFS.stat(destPath).catch(() => null)
    if (!stat || Number(stat.size) < 1024) {
      await RNFS.unlink(destPath).catch(() => {})
      throw new Error('invalid file')
    }
    onProgress?.({ loaded: Number(stat.size), total: Number(stat.size) })
    return {
      filePath: destPath,
      fileName: destPath.slice(destPath.lastIndexOf('/') + 1),
      isPublic: destIsPublic,
    }
  })()

  return {
    promise,
    cancel() {
      canceled = true
      if (jobId != null) RNFS.stopDownload(jobId)
    },
  }
}

/** 下载目录的展示用路径，如 Music/LX音乐 */
export const getDownloadDirLabel = (isPublic = true) => {
  return isPublic
    ? `Music/${DOWNLOAD_DIR_NAME}`
    : `Android/data/cn.toside.music.mobile/files/${DOWNLOAD_DIR_NAME}`
}
