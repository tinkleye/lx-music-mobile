import { NativeEventEmitter, NativeModules } from 'react-native'

const { UserApiModule } = NativeModules

// 【改造】可能同时加载多个自定义源（主源 + 备用源），这里按 id 分别记录脚本信息
const loadScriptInfos = new Map<string, LX.UserApi.UserApiInfo>()
export const loadScript = (info: LX.UserApi.UserApiInfo & { script: string }) => {
  loadScriptInfos.set(info.id, info)
  UserApiModule.loadScript({
    id: info.id,
    name: info.name,
    description: info.description,
    version: info.version ?? '',
    author: info.author ?? '',
    homepage: info.homepage ?? '',
    script: info.script,
  })
}

export interface SendResponseParams {
  requestKey: string
  error: string | null
  response: {
    statusCode: number
    statusMessage: string
    headers: Record<string, string>
    body: any
  } | null
}
export interface SendActions {
  request: LX.UserApi.UserApiRequestParams
  response: SendResponseParams
}
export const sendAction = <T extends keyof SendActions>(action: T, data: SendActions[T], apiId: string) => {
  UserApiModule.sendAction(apiId, action, JSON.stringify(data))
}

// export const clearAppCache = CacheModule.clearAppCache as () => Promise<void>

export interface InitParams {
  status: boolean
  errorMessage: string
  info: LX.UserApi.UserApiInfo
}

export interface ResponseParams {
  status: boolean
  errorMessage?: string
  requestKey: string
  result: any
}
export interface UpdateInfoParams {
  name: string
  log: string
  updateUrl: string
}
export interface RequestParams {
  requestKey: string
  url: string
  options: {
    method: string
    data: any
    timeout: number
    headers: any
    binary: boolean
  }
}
export type CancelRequestParams = string

export interface Actions {
  init: InitParams
  request: RequestParams
  cancelRequest: CancelRequestParams
  response: ResponseParams
  showUpdateAlert: UpdateInfoParams
  log: string
}
export type ActionsEvent = { [K in keyof Actions]: { action: K, data: Actions[K], apiId?: string } }[keyof Actions]

export const onScriptAction = (handler: (event: ActionsEvent) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UserApiModule)
  const eventListener = eventEmitter.addListener('api-action', event => {
    if (event.data) event.data = JSON.parse(event.data as string)
    // 【改造】事件带上 apiId，用于区分主源与备用源
    const apiId = (event.apiId as string | undefined) ?? (event.data?.info?.id as string | undefined) ?? ''
    if (apiId) event.apiId = apiId
    const scriptInfo = apiId ? loadScriptInfos.get(apiId) : undefined
    if (event.action == 'init') {
      if (event.data.info) event.data.info = { ...scriptInfo, ...event.data.info }
      else event.data.info = { ...scriptInfo }
    } else if (event.action == 'showUpdateAlert') {
      if (!scriptInfo?.allowShowUpdateAlert) return
    }
    handler(event as ActionsEvent)
  })

  return () => {
    eventListener.remove()
  }
}

export const destroy = () => {
  UserApiModule.destroy()
}

// 【改造】只销毁指定的源（切换主源时不影响其它备用源）
export const destroyScript = (apiId: string) => {
  loadScriptInfos.delete(apiId)
  UserApiModule.destroyScript(apiId)
}
