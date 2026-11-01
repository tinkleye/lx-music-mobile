import { type InitParams, onScriptAction, sendAction, type ResponseParams, type UpdateInfoParams, type RequestParams } from '@/utils/nativeModules/userApi'
import { log, notifyUserApiInit, setUserApiList, setUserApiStatus } from '@/core/userApi'
import settingState from '@/store/setting/state'
import BackgroundTimer from 'react-native-background-timer'
import { fetchData } from './request'
import { getUserApiFallbacks, getUserApiList } from '@/utils/data'
import { confirmDialog, openUrl, tipDialog } from '@/utils/tools'


export default async(setting: LX.AppSetting) => {
  const userApiRequestMap = new Map<string, { resolve: (value: ResponseParams['result']) => void, reject: (error: Error) => void, timeout: number }>()
  const scriptRequestMap = new Map<string, { request: Promise<any>, abort: () => void }>()

  const cancelRequest = (requestKey: string, message: string) => {
    const target = scriptRequestMap.get(requestKey)
    if (!target) return
    scriptRequestMap.delete(requestKey)
    target.abort()
  }
  const sendScriptRequest = (requestKey: string, url: string, options: RequestParams['options'], apiId: string) => {
    let req = fetchData(url, options)
    req.request.then(response => {
      // console.log(response)
      sendAction('response', {
        error: null,
        requestKey,
        response,
      }, apiId)
    }).catch(err => {
      sendAction('response', {
        error: err.message,
        requestKey,
        response: null,
      }, apiId)
    }).finally(() => {
      scriptRequestMap.delete(requestKey)
    })
    scriptRequestMap.set(requestKey, req)
  }
  const sendUserApiRequest = async(apiId: string, data: LX.UserApi.UserApiRequestParams) => {
    const handleApiUpdate = () => {
      const target = userApiRequestMap.get(data.requestKey)
      if (!target) return
      userApiRequestMap.delete(data.requestKey)
      BackgroundTimer.clearTimeout(target.timeout)
      target.reject(new Error('request failed'))
    }
    const requestPromise = new Promise<ResponseParams['result']>((resolve, reject) => {
      userApiRequestMap.set(data.requestKey, {
        resolve,
        reject,
        timeout: BackgroundTimer.setTimeout(() => {
          const target = userApiRequestMap.get(data.requestKey)
          if (!target) return
          userApiRequestMap.delete(data.requestKey)
          target.reject(new Error('request timeout'))
        }, 20_000),
      })
      sendAction('request', data, apiId)
    }).finally(() => {
      global.state_event.off('apiSourceUpdated', handleApiUpdate)
    })
    global.state_event.on('apiSourceUpdated', handleApiUpdate)
    return requestPromise
  }
  const handleUserApiResponse = ({ status, result, requestKey, errorMessage }: ResponseParams) => {
    const target = userApiRequestMap.get(requestKey)
    if (!target) return
    userApiRequestMap.delete(requestKey)
    BackgroundTimer.clearTimeout(target.timeout)
    if (status) target.resolve(result)
    else target.reject(new Error(errorMessage ?? 'failed'))
  }

  // 【改造】按 apiId 构建该源的 apis / 音质表，请求也带上 apiId 发回对应的脚本线程
  const buildApis = (apiId: string, sources: LX.UserApi.UserApiSources) => {
    const apis: Record<string, any> = {}
    const qualitys: LX.QualityList = {}
    for (const [source, { actions, type, qualitys: sourceQualitys }] of Object.entries(sources)) {
      if (type != 'music') continue
      apis[source] = {}
      for (const action of actions) {
        switch (action) {
          case 'musicUrl':
            apis[source].getMusicUrl = (songInfo: LX.Music.MusicInfo, quality: LX.Quality) => {
              const requestKey = `request__${Math.random().toString().substring(2)}`
              return {
                canceleFn() {
                  // userApiRequestCancel(requestKey)
                },
                promise: sendUserApiRequest(apiId, {
                  requestKey,
                  data: {
                    source,
                    action: 'musicUrl',
                    info: {
                      type: quality,
                      musicInfo: songInfo,
                    },
                  },
                  // eslint-disable-next-line @typescript-eslint/promise-function-async
                }).then(res => {
                  // console.log(res)
                  return { type: quality, url: res.data.url }
                }).catch(err => {
                  console.log(err.message)
                  throw err
                }),
              }
            }
            break
          case 'lyric':
            apis[source].getLyric = (songInfo: LX.Music.MusicInfo) => {
              const requestKey = `request__${Math.random().toString().substring(2)}`
              return {
                canceleFn() {
                  // userApiRequestCancel(requestKey)
                },
                promise: sendUserApiRequest(apiId, {
                  requestKey,
                  data: {
                    source,
                    action: 'lyric',
                    info: {
                      type,
                      musicInfo: songInfo,
                    },
                  },
                  // eslint-disable-next-line @typescript-eslint/promise-function-async
                }).then(res => {
                  // console.log(res)
                  return res.data
                }).catch(async err => {
                  console.log(err.message)
                  return Promise.reject(err)
                }),
              }
            }
            break
          case 'pic':
            apis[source].getPic = (songInfo: LX.Music.MusicInfo) => {
              const requestKey = `request__${Math.random().toString().substring(2)}`
              return {
                canceleFn() {
                  // userApiRequestCancel(requestKey)
                },
                promise: sendUserApiRequest(apiId, {
                  requestKey,
                  data: {
                    source,
                    action: 'pic',
                    info: {
                      type,
                      musicInfo: songInfo,
                    },
                  },
                  // eslint-disable-next-line @typescript-eslint/promise-function-async
                }).then(res => {
                  // console.log(res)
                  return res.data
                }).catch(async err => {
                  console.log(err.message)
                  return Promise.reject(err)
                }),
              }
            }
            break
          default:
            break
        }
      }
      qualitys[source as LX.Source] = sourceQualitys
    }
    return { apis, qualitys }
  }

  const handleStateChange = ({ status, errorMessage, info }: InitParams, eventApiId?: string) => {
    // console.log(status, message, info)
    if (!global.lx.apisMap) global.lx.apisMap = {}
    const apiId = info?.id ?? eventApiId ?? ''
    const isActiveApi = !!apiId && apiId == settingState.setting['common.apiSource']
    // 只有主源的状态才同步到设置页展示，备用源的初始化结果不干扰界面
    if (!apiId || isActiveApi) setUserApiStatus(status, errorMessage)

    if (status) {
      if (info?.sources && apiId) {
        const { apis, qualitys } = buildApis(apiId, info.sources)
        global.lx.apisMap[apiId] = { apis, qualityList: qualitys, status: true }
        if (isActiveApi) {
          global.lx.qualityList = qualitys
          global.lx.apis = apis
          global.state_event.apiSourceUpdated(apiId)
        }
      }
    } else {
      if (apiId) global.lx.apisMap[apiId] = { apis: {}, qualityList: {}, status: false }
      if (errorMessage && (isActiveApi || !apiId)) {
        void tipDialog({
          message: `${global.i18n.t('user_api__init_failed_alert', { name: info?.name ?? apiId })}\n${errorMessage}`,
          // selection: true,
          btnText: global.i18n.t('ok'),
        })
      }
    }
    if (apiId) notifyUserApiInit(apiId, status)
    if (isActiveApi && !global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](status)
  }
  const showUpdateAlert = ({ name, log, updateUrl }: UpdateInfoParams) => {
    if (updateUrl) {
      void confirmDialog({
        message: `${global.i18n.t('user_api_update_alert', { name })}\n${log}`,
        // selection: true,
        // showCancel: true,
        confirmButtonText: global.i18n.t('user_api_update_alert_open_url'),
        cancelButtonText: global.i18n.t('close'),
      }).then(confirm => {
        if (!confirm) return
        setTimeout(() => {
          void openUrl(updateUrl)
        }, 300)
      })
    } else {
      void tipDialog({
        message: `${global.i18n.t('user_api_update_alert', { name })}\n${log}`,
        // selection: true,
        btnText: global.i18n.t('ok'),
      })
    }
  }

  onScriptAction((event) => {
    // console.log('script actuon: ', event)
    const apiId = event.apiId ?? ''
    switch (event.action) {
      case 'init':
        if ((event as unknown as { errorMessage?: string }).errorMessage) event.data.errorMessage = (event as unknown as { errorMessage: string }).errorMessage
        handleStateChange(event.data, apiId)
        break
      case 'response':
        handleUserApiResponse(event.data)
        break
      case 'request':
        sendScriptRequest(event.data.requestKey, event.data.url, event.data.options, apiId)
        break
      case 'cancelRequest':
        cancelRequest(event.data, 'request canceled')
        break
      case 'showUpdateAlert':
        showUpdateAlert(event.data)
        break
      case 'log':
        switch ((event as unknown as { type: keyof typeof log }).type) {
          case 'log':
          case 'info':
            log.info((event as unknown as { log: string }).log)
            break
          case 'error':
            log.error((event as unknown as { log: string }).log)
            break
          case 'warn':
            log.warn((event as unknown as { log: string }).log)
            break
          default:
            break
        }
        break
      default:
        break
    }
  })

  setUserApiList(await getUserApiList())
  // 【改造】读取备用源顺序，缓存起来供取址时使用
  await getUserApiFallbacks()
}
