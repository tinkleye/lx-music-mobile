import RNFS from 'react-native-fs'
import { NativeModules } from 'react-native'
import { getMusicUrl, getLyricInfo, getPicPath } from '@/core/music'
import { writeLyric, writePic } from '@/utils/localMediaMetadata'
import { getExternalStoragePaths, temporaryDirectoryPath } from '@/utils/fs'
import settingState from '@/store/setting/state'

const DOWNLOAD_UA = 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Mobile Safari/537.36'

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

/** 供设置页选择下载目录用的候选列表（含 U盘/外置存储卷），默认在前、私有兜底在后 */
export const getDownloadDirCandidates = async(): Promise<string[]> => {
  const dirs = getDirCandidates()
  try {
    const roots = await getExternalStoragePaths(true)
    for (const root of roots ?? []) {
      if (!root) continue
      const norm = root.replace(/\/+$/, '')
      if (norm == RNFS.ExternalStorageDirectoryPath || norm == RNFS.ExternalDirectoryPath) continue
      if (!dirs.includes(`${norm}/${DOWNLOAD_DIR_NAME}`)) dirs.push(`${norm}/${DOWNLOAD_DIR_NAME}`)
    }
  } catch (err) {
    console.log('list removable storage failed:', err)
  }
  return dirs
}

/** 当前生效的下载目录：自定义优先，否则默认第一个候选 */
export const getDownloadDir = () => {
  const custom = settingState.setting['download.dir']
  return (custom && custom.trim()) || getDirCandidates()[0]
}

/**
 * 【v64】下载目录是否落在 U 盘/外置卷（或 SAF 授权目录）。
 * 这类卷直写易触发重挂载，多路并发会加剧，下载队列据此降为串行。
 */
export const isUsbDownloadDir = () => {
  const dir = getDownloadDir()
  if (dir.startsWith('content://')) return true
  const norm = dir.replace(/\/+$/, '')
  return norm.startsWith('/storage/') && !norm.startsWith('/storage/emulated/')
}

/** 分组返回下载目录候选：内置存储 + U盘/外置卷（供设置页分组展示） */
export const getDownloadDirCandidatesGrouped = async(): Promise<{ builtin: string[], usb: string[] }> => {
  const all = await getDownloadDirCandidates()
  const builtinCount = getDirCandidates().length
  return { builtin: all.slice(0, builtinCount), usb: all.slice(builtinCount) }
}

/** 下载目录的展示用路径 */
export const getDownloadDirLabel = () => {
  const custom = settingState.setting['download.dir']
  if (custom && custom.trim()) return custom
  return `Music/${DOWNLOAD_DIR_NAME}`
}

const prepareDownloadDir = async(): Promise<{ dir: string, isPublic: boolean }> => {
  const custom = (settingState.setting['download.dir'] || '').trim()
  if (custom) {
    // 【v64】U 盘/外置卷直写会短暂重挂载（remount），写探针此刻会失败；先重试等待
    // 挂载恢复，而不是立即静默降级到内置存储，避免「设了 U 盘却存到内置」。
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (!await RNFS.exists(custom)) await RNFS.mkdir(custom)
        const probe = `${custom.replace(/\/+$/, '')}/.lx_write_test`
        await RNFS.writeFile(probe, 'ok', 'utf8')
        await RNFS.unlink(probe)
        return { dir: custom, isPublic: !custom.startsWith(RNFS.ExternalDirectoryPath) }
      } catch (err) {
        console.log('custom download dir not writable, attempt:', attempt + 1, custom, err)
        // 目录都不存在（U 盘被拔出）则重试无意义，直接降级
        const stillExists = await RNFS.exists(custom).catch(() => false)
        if (!stillExists) break
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500))
      }
    }
  }
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
 * 【v42】支持 allowToggleSource：取不到目标音质时是否自动换源/降级。
 */
export const startDownload = ({ musicInfo, quality, onProgress, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfo
  quality: LX.Quality
  onProgress?: (progress: DownloadProgress) => void
  allowToggleSource?: boolean
}): DownloadTaskHandle => {
  let jobId: number | null = null
  let canceled = false
  let destPath = ''
  let destIsPublic = true

  const promise = (async(): Promise<DownloadResult> => {
    const custom = (settingState.setting['download.dir'] || '').trim()
    // 【v62】SAF 授权目录（content:// treeUri）：走原生流式下载，
    // 换 DocumentsProvider + ContentResolver 底层通道，规避直写 exFAT U 盘导致的重挂载
    if (custom.startsWith('content://')) {
      if (canceled) throw new DownloadCanceledError()
      const url = await getMusicUrl({ musicInfo, quality, isRefresh: true, allowToggleSource })
      if (!url) throw new Error('empty url')
      if (canceled) throw new DownloadCanceledError()
      const baseName = sanitizeFileName(
        settingState.setting['download.fileName']
          .replace('歌手', musicInfo.singer ?? '')
          .replace('歌名', musicInfo.name),
      )
      const ext = getExtFromUrl(url, quality)
      const fileName = `${baseName}.${ext}`
      const res = await NativeModules.MediaScannerModule.downloadToTree(custom, url, fileName, DOWNLOAD_UA)
      const size = Number(res?.size) || 0
      onProgress?.({ loaded: size, total: size })
      return {
        filePath: res.filePath,
        fileName: res.fileName,
        isPublic: false,
      }
    }

    const { dir, isPublic } = await prepareDownloadDir()
    destIsPublic = isPublic
    if (canceled) throw new DownloadCanceledError()

    // 直链会过期，这里强制重新取一次，不复用缓存
    const url = await getMusicUrl({ musicInfo, quality, isRefresh: true, allowToggleSource })
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
    // 【v43】内嵌标签 / 附加文件：失败不影响下载结果本身
    await applyDownloadPostProcess(musicInfo, destPath, dir, baseName)
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

/** 下载封面图到临时目录，返回本地文件路径（http 下载 / 本地直接复用） */
const fetchCoverToLocal = async(picUrl: string): Promise<string | null> => {
  try {
    if (/^https?:\/\//i.test(picUrl)) {
      const tmp = `${temporaryDirectoryPath}/lx_cover_${Date.now()}.jpg`
      const res = await RNFS.downloadFile({ fromUrl: picUrl, toFile: tmp }).promise
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) return null
      return tmp
    }
    if (await RNFS.exists(picUrl)) return picUrl
    return null
  } catch (err) {
    console.log('fetch cover failed:', err)
    return null
  }
}

/** 【v43】下载后处理：内嵌封面/歌词、另存 .lrc / 封面文件 */
const applyDownloadPostProcess = async(
  musicInfo: LX.Music.MusicInfo,
  destPath: string,
  dir: string,
  baseName: string,
) => {
  const setting = settingState.setting
  const needLyric = setting['download.isSaveLrc'] || setting['download.isEmbedLyric']
  const needCover = setting['download.isSaveCover'] || setting['download.isEmbedCover']
  if (!needLyric && !needCover) return

  try {
    if (needLyric) {
      const lyricInfo = await getLyricInfo({ musicInfo })
      const lyric = lyricInfo?.lyric
      if (lyric) {
        if (setting['download.isSaveLrc']) {
          await RNFS.writeFile(`${dir}/${baseName}.lrc`, lyric, 'utf8').catch(() => {})
        }
        if (setting['download.isEmbedLyric']) {
          await writeLyric(destPath, lyric).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.log('download post-process lyric failed:', err)
  }

  try {
    if (needCover) {
      const picUrl = await getPicPath({ musicInfo })
      const coverPath = picUrl ? await fetchCoverToLocal(picUrl) : null
      if (coverPath) {
        if (setting['download.isSaveCover']) {
          const ext = coverPath.lastIndexOf('.') > 0 ? coverPath.slice(coverPath.lastIndexOf('.')) : '.jpg'
          await RNFS.copyFile(coverPath, `${dir}/${baseName}${ext}`).catch(() => {})
        }
        if (setting['download.isEmbedCover']) {
          await writePic(destPath, coverPath).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.log('download post-process cover failed:', err)
  }
}

