import { saveData, getData } from '@/plugins/storage'
import settingState from '@/store/setting/state'
import { startDownload, getDownloadQualitys, QUALITY_ORDER, DownloadCanceledError, type DownloadProgress } from '@/core/download'
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
    const pending = tasks
      .filter(t => t.status == 'waiting' || t.status == 'running')
      .map(t => ({ id: t.id, musicInfo: t.musicInfo, quality: t.quality }))
    void saveData(PERSIST_KEY, pending).catch(() => {})
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
  handle.promise.then(() => {
    task.status = 'done'
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

export const removeTask = (id: string) => {
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

/** App 启动时恢复未完成任务（重新排队，从头下载） */
export const initDownloadQueue = async() => {
  if (initialized) return
  initialized = true
  try {
    const pending = await getData<Array<{ id: string, musicInfo: LX.Music.MusicInfo, quality: LX.Quality }>>(PERSIST_KEY)
    if (Array.isArray(pending) && pending.length) {
      for (const item of pending) {
        if (!item?.musicInfo) continue
        tasks.unshift({
          id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          musicInfo: item.musicInfo,
          quality: item.quality,
          status: 'waiting',
          progress: { loaded: 0, total: 0 },
        })
      }
      notify()
      void pump()
    }
  } catch (err) {
    console.log('init download queue failed:', err)
  }
}
