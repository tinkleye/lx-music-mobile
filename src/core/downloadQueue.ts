import { saveData, getData } from '@/plugins/storage'
import settingState from '@/store/setting/state'
import { startDownload, getDownloadQualitys, QUALITY_ORDER, DownloadCanceledError, type DownloadProgress, type DownloadResult } from '@/core/download'
import { readDir, unlink } from '@/utils/fs'
import { toast } from '@/utils/tools'

/**
 * 【v42】下载队列管理。
 *
 * 在自研轻量下载器（core/download）之上加一层队列：
 * - 并发数可配置（download.concurrency，默认 3）；
 * - 任务状态：等待中 / 下载中 / 失败（可重试）/ 已完成 / 已取消；
 * - 重启续排：等待中与下载中的任务持久化到本地，App 重启后自动重新排队
 *   （从头下载，不支持断点续传），已完成的不会重复下载；
 * - 重复加入队列的同名歌曲自动跳过；单次批量加入上限 200 首。
 */

const PERSIST_KEY = '@download_pending_queue'
const BATCH_LIMIT = 200

export type DownloadTaskStatus = 'waiting' | 'running' | 'paused' | 'done' | 'failed' | 'canceled'

export interface DownloadTask {
  id: string
  musicInfo: LX.Music.MusicInfo
  quality: LX.Quality
  status: DownloadTaskStatus
  progress: DownloadProgress
  error?: string
  /** 【v51】下载完成后落盘的音频文件路径（删除本地文件时用） */
  filePath?: string
}

let tasks: DownloadTask[] = []
const listeners = new Set<() => void>()
const runningHandles = new Map<string, { cancel: () => void }>()
const pausedIds = new Set<string>()
let persistTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false

const notify = () => {
  for (const listener of listeners) listener()
}

const persist = () => {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    // 【v53】保存全部任务（含已完成/失败/暂停），重启后「已下载」「下载失败」
    // 列表不再被清空；filePath 一并持久化，属性弹窗/删除本地文件在重启后仍可用
    const all = tasks.map(t => ({
      id: t.id,
      musicInfo: t.musicInfo,
      quality: t.quality,
      status: t.status,
      progress: t.progress,
      error: t.error,
      filePath: t.filePath,
    }))
    void saveData(PERSIST_KEY, all).catch(() => {})
  }, 800)
}

export const subscribeDownloadTasks = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getDownloadTasks = (): DownloadTask[] => tasks

const findNextWaiting = () => tasks.find(t => t.status == 'waiting')

const runTask = (task: DownloadTask) => {
  task.status = 'running'
  task.progress = { loaded: 0, total: 0 }
  task.error = undefined
  notify()
  const handle = startDownload({
    musicInfo: task.musicInfo,
    quality: task.quality,
    allowToggleSource: settingState.setting['download.isAutoToggleSource'] !== false,
    onProgress: (p) => {
      task.progress = p
      notify()
    },
  })
  runningHandles.set(task.id, handle)
  handle.promise.then((res: DownloadResult) => {
    task.status = 'done'
    task.filePath = res.filePath
    toast(global.i18n.t('download_task_done_tip', { name: task.musicInfo.name }))
  }).catch((err: Error) => {
    if (pausedIds.has(task.id)) {
      pausedIds.delete(task.id)
      task.status = 'paused'
    } else if (err instanceof DownloadCanceledError || err.name == 'DownloadCanceledError') {
      task.status = 'canceled'
    } else {
      task.status = 'failed'
      task.error = err.message
      toast(global.i18n.t('download_task_failed_tip', { name: task.musicInfo.name }))
    }
  }).finally(() => {
    runningHandles.delete(task.id)
    persist()
    notify()
    void pump()
  })
}

/** 按并发数推进等待中的任务 */
const pump = async() => {
  const concurrency = Math.max(1, Math.min(6, Number(settingState.setting['download.concurrency']) || 3))
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  while (runningHandles.size < concurrency) {
    const next = findNextWaiting()
    if (!next) break
    runTask(next)
  }
}

/**
 * 按用户设置挑选下载音质：未开启"总是询问音质"时按播放音质下单，
 * 源不支持时自动降到最接近的可用音质。
 */
export const autoPickQuality = (musicInfo: LX.Music.MusicInfo): LX.Quality => {
  const available = getDownloadQualitys(musicInfo).map(q => q.quality)
  if (!available.length) return settingState.setting['player.playQuality']
  const preferred = settingState.setting['download.quality'] || settingState.setting['player.playQuality']
  if (available.includes(preferred)) return preferred
  // 从偏好音质往下找，找不到再往高档兜底
  const idx = QUALITY_ORDER.indexOf(preferred)
  const lower = idx > -1 ? QUALITY_ORDER.slice(idx + 1).find(q => available.includes(q)) : undefined
  return lower ?? available[0]
}

/**
 * 加入下载队列。返回 { added, skipped }（同名歌曲在队列中已存在则跳过）。
 */
export const addDownloadTasks = (musicInfos: LX.Music.MusicInfo[], quality?: LX.Quality): { added: number, skipped: number } => {
  let list = musicInfos
  let skipped = 0
  if (list.length > BATCH_LIMIT) {
    skipped += list.length - BATCH_LIMIT
    list = list.slice(0, BATCH_LIMIT)
  }
  const existingIds = new Set(tasks.filter(t => t.status == 'waiting' || t.status == 'running' || t.status == 'paused').map(t => t.musicInfo.id))
  let added = 0
  for (const musicInfo of list) {
    if (existingIds.has(musicInfo.id)) {
      skipped++
      continue
    }
    existingIds.add(musicInfo.id)
    tasks.unshift({
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      musicInfo,
      quality: quality ?? autoPickQuality(musicInfo),
      status: 'waiting',
      progress: { loaded: 0, total: 0 },
    })
    added++
  }
  if (added) {
    persist()
    notify()
    void pump()
  }
  return { added, skipped }
}

export const retryTask = (id: string) => {
  const task = tasks.find(t => t.id == id)
  if (!task || task.status == 'running' || task.status == 'waiting') return
  task.status = 'waiting'
  task.error = undefined
  persist()
  notify()
  void pump()
}

/** 【v43】暂停：运行中的中断、等待中的转暂停（位置保留，不占并发） */
export const pauseTask = (id: string) => {
  const task = tasks.find(t => t.id == id)
  if (!task || task.status == 'done' || task.status == 'failed' || task.status == 'canceled' || task.status == 'paused') return
  if (task.status == 'running') {
    pausedIds.add(id)
    runningHandles.get(id)?.cancel()
    return
  }
  if (task.status == 'waiting') {
    task.status = 'paused'
    persist()
    notify()
  }
}

/** 【v43】恢复暂停的任务继续下载 */
export const resumeTask = (id: string) => {
  const task = tasks.find(t => t.id == id)
  if (!task || task.status != 'paused') return
  task.status = 'waiting'
  persist()
  notify()
  void pump()
}

export const cancelTask = (id: string) => {
  const task = tasks.find(t => t.id == id)
  if (!task) return
  if (task.status == 'running') {
    runningHandles.get(task.id)?.cancel()
    return
  }
  if (task.status == 'waiting') {
    task.status = 'canceled'
    persist()
    notify()
  }
}

/**
 * 【v51】删除下载任务落盘的本地文件：音频 + 同 basename 的歌词(.lrc)/封面(任意扩展名)。
 * 下载后处理（applyDownloadPostProcess）生成的附加文件与音频同目录、同 basename，
 * 因此按「去掉扩展名后的文件名 == 音频 basename」匹配即可精确覆盖全部相关文件。
 */
const removeDownloadedFiles = async(filePath: string) => {
  const slash = filePath.lastIndexOf('/')
  const dir = filePath.slice(0, slash)
  const fileName = filePath.slice(slash + 1)
  const dot = fileName.lastIndexOf('.')
  const base = dot > 0 ? fileName.slice(0, dot) : fileName
  try {
    const files = await readDir(dir)
    for (const f of files) {
      if (!f.isFile) continue
      const name = f.name
      const n = name.lastIndexOf('.') > 0 ? name.slice(0, name.lastIndexOf('.')) : name
      if (n == base) await unlink(f.path).catch(() => {})
    }
  } catch (err) {
    console.log('remove downloaded files failed:', err)
  }
}

/**
 * 移除下载任务。
 * @param removeFiles 为 true 时同时删除落盘的音频/歌词/封面文件（仅已完成的、有 filePath 的任务）
 */
export const removeTask = (id: string, removeFiles: boolean = false) => {
  const task = tasks.find(t => t.id == id)
  if (removeFiles && task?.filePath) void removeDownloadedFiles(task.filePath)
  tasks = tasks.filter(t => t.id != id)
  persist()
  notify()
}

export const clearFinishedTasks = () => {
  tasks = tasks.filter(t => t.status == 'waiting' || t.status == 'running' || t.status == 'paused')
  persist()
  notify()
}

export const cancelAllTasks = () => {
  for (const task of tasks) {
    if (task.status == 'running') runningHandles.get(task.id)?.cancel()
    else if (task.status == 'waiting') task.status = 'canceled'
  }
  persist()
  notify()
}

export const getActiveTaskCount = () => {
  return tasks.filter(t => t.status == 'waiting' || t.status == 'running').length
}

/** 持久化的任务快照（含全部状态） */
type PersistedTask = {
  id: string
  musicInfo: LX.Music.MusicInfo
  quality: LX.Quality
  status: DownloadTaskStatus
  progress: DownloadProgress
  error?: string
  filePath?: string
}

const genId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

/** App 启动时恢复下载列表：未完成的重新排队，已终止的按原状态恢复 */
export const initDownloadQueue = async() => {
  if (initialized) return
  initialized = true
  try {
    const saved = await getData<PersistedTask[]>(PERSIST_KEY)
    if (Array.isArray(saved) && saved.length) {
      for (const item of saved) {
        if (!item?.musicInfo) continue
        // 【v53】waiting/running 重启后从头重新下载；其余按原状态恢复（done 保留 filePath）
        const incomplete = item.status == 'waiting' || item.status == 'running'
        tasks.push({
          id: item.id ?? genId(),
          musicInfo: item.musicInfo,
          quality: item.quality,
          status: incomplete ? 'waiting' : item.status,
          progress: incomplete ? { loaded: 0, total: 0 } : (item.progress ?? { loaded: 0, total: 0 }),
          error: incomplete ? undefined : item.error,
          filePath: item.filePath,
        })
      }
      notify()
      void pump()
    }
  } catch (err) {
    console.log('init download queue failed:', err)
  }
}
