import { action, state } from '@/store/userApi'
import {
  addUserApi,
  getUserApiScript,
  parseUserApiScriptInfo,
  removeUserApi as removeUserApiFromStore,
  setUserApiAllowShowUpdateAlert as setUserApiAllowShowUpdateAlertFromStore,
  updateUserApiScript as updateUserApiScriptFromStore,
} from '@/utils/data'
import { destroy, loadScript } from '@/utils/nativeModules/userApi'
import { log as writeLog } from '@/utils/log'
import { httpFetch } from '@/utils/request'
import settingState from '@/store/setting/state'

const SCRIPT_MAX_SIZE = 9_000_000


export const setUserApi = async(apiId: string) => {
  global.lx.qualityList = {}
  setUserApiStatus(false, 'initing')

  const target = state.list.find(api => api.id === apiId)
  if (!target) throw new Error('api not found')
  const script = await getUserApiScript(target.id)
  loadScript({ ...target, script })
}

export const destroyUserApi = () => {
  destroy()
}


export const setUserApiStatus: typeof action['setStatus'] = (status, message) => {
  action.setStatus(status, message)
}

export const setUserApiList: typeof action['setUserApiList'] = (list) => {
  action.setUserApiList(list)
}

/**
 * 【改造】导入自定义源。
 *
 * 传入 sourceUrl 时会记录来源地址，后续可据此自动检查更新。
 * 如果该地址已存在（或旧版本导入的同名源没有记录地址），则视为「更新」而不是新增，
 * 避免同一个源出现两份，也不需要手动删掉旧的再重新导入。
 */
export const importUserApi = async(script: string, sourceUrl?: string): Promise<{ updated: boolean, info: LX.UserApi.UserApiInfo }> => {
  const url = sourceUrl?.trim() || undefined

  if (url) {
    const scriptInfo = parseUserApiScriptInfo(script)
    const target = state.list.find(api => api.sourceUrl && api.sourceUrl == url) ??
      // 兼容旧版本导入、没有记录地址的源：同名视为同一个源
      state.list.find(api => !api.sourceUrl && api.name == scriptInfo.name)

    if (target) {
      const info = await updateUserApi(target.id, script, url)
      return { updated: true, info }
    }
  }

  const info = await addUserApi(script, url)
  action.addUserApi(info)
  return { updated: false, info }
}

/**
 * 【改造】用新脚本原地更新已有源（id 不变，正在启用的源会自动重新加载）。
 */
export const updateUserApi = async(id: string, script: string, sourceUrl?: string): Promise<LX.UserApi.UserApiInfo> => {
  const info = await updateUserApiScriptFromStore(id, script, sourceUrl)
  action.setUserApiList([...state.list])

  // 如果当前正在用这个源，重新加载让新脚本立即生效
  if (settingState.setting['common.apiSource'] == id) {
    await setUserApi(id).catch(err => {
      log.error(err)
    })
  }

  return info
}

export const removeUserApi = async(ids: string[]) => {
  const list = await removeUserApiFromStore(ids)
  action.setUserApiList(list)
}

export const setUserApiAllowShowUpdateAlert = async(id: string, enable: boolean) => {
  await setUserApiAllowShowUpdateAlertFromStore(id, enable)
  action.setUserApiAllowShowUpdateAlert(id, enable)
}

/**
 * 【改造】拉取远端源脚本。
 */
export const fetchUserApiScript = async(url: string): Promise<string> => {
  const script = await httpFetch(url).promise.then(resp => resp.body) as string
  if (typeof script !== 'string' || !script.length) throw new Error('Empty response')
  if (script.length > SCRIPT_MAX_SIZE) throw new Error('Too large script')
  return script
}

/**
 * 判断远端脚本相对本地版本是否有变化。
 * 优先比对头部注释里的 @version，版本号缺失或相同再比对脚本原文。
 */
const isScriptChanged = async(api: LX.UserApi.UserApiInfo, newScript: string): Promise<boolean> => {
  const newInfo = parseUserApiScriptInfo(newScript)
  const newVersion = (newInfo.version || '').trim()
  const oldVersion = (api.version || '').trim()
  if (newVersion && oldVersion && newVersion != oldVersion) return true

  const oldScript = await getUserApiScript(api.id)
  return oldScript.trim() != newScript.trim()
}

export type UserApiUpdateResult =
  | { status: 'updated', info: LX.UserApi.UserApiInfo }
  | { status: 'none' }
  | { status: 'no_url' }
  | { status: 'not_found' }
  | { status: 'failed', message: string }

/**
 * 【改造】检查并更新单个自定义源。
 */
export const checkUserApiUpdate = async(id: string): Promise<UserApiUpdateResult> => {
  const target = state.list.find(api => api.id == id)
  if (!target) return { status: 'not_found' }
  if (!target.sourceUrl) return { status: 'no_url' }

  try {
    const script = await fetchUserApiScript(target.sourceUrl)
    if (!await isScriptChanged(target, script)) return { status: 'none' }
    const info = await updateUserApi(id, script)
    return { status: 'updated', info }
  } catch (err: any) {
    log.error(err)
    return { status: 'failed', message: String(err?.message ?? err) }
  }
}

export interface UserApiUpdateSummary {
  checked: number
  updated: number
  failed: number
  skipped: number
}

let checkingPromise: Promise<UserApiUpdateSummary> | null = null

/**
 * 【改造】批量检查所有记录了来源地址的自定义源。
 * 启动时会自动调用一次（受设置项 common.autoUpdateUserApi 控制）。
 */
export const checkUserApiUpdates = async(): Promise<UserApiUpdateSummary> => {
  if (checkingPromise) return checkingPromise

  checkingPromise = (async(): Promise<UserApiUpdateSummary> => {
    const ids = state.list.filter(api => !!api.sourceUrl).map(api => api.id)
    const summary: UserApiUpdateSummary = {
      checked: ids.length,
      updated: 0,
      failed: 0,
      skipped: state.list.length - ids.length,
    }
    for (const id of ids) {
      const result = await checkUserApiUpdate(id)
      if (result.status == 'updated') summary.updated++
      else if (result.status == 'failed') summary.failed++
    }
    return summary
  })()

  try {
    return await checkingPromise
  } finally {
    checkingPromise = null
  }
}

export const log = {
  r_info(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.info(...params)
  },
  r_warn(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.warn(...params)
  },
  r_error(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.error(...params)
  },
  log(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.info(...params)
  },
  info(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.info(...params)
  },
  warn(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.warn(...params)
  },
  error(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.error(...params)
  },
}
