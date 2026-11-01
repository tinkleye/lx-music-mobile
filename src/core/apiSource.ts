// import { setUserApi as setUserApiAction } from '@renderer/utils/ipc'
import musicSdk from '@/utils/musicSdk'
// import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import { updateSetting } from './common'
import settingState from '@/store/setting/state'
import { destroyUserApi, setUserApi } from './userApi'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { getUserApiFallbacksSync, setUserApiFallbacks } from '@/utils/data'


export const setApiSource = (apiId: string) => {
  const prevApiId = settingState.setting['common.apiSource']
  // 【改造】主源不应该再出现在自己的备用列表里
  if (/^user_api/.test(apiId)) {
    const fallbacks = getUserApiFallbacksSync()
    if (fallbacks.includes(apiId)) void setUserApiFallbacks(fallbacks.filter(id => id != apiId))
  }
  if (global.lx.apiInitPromise[1]) {
    global.lx.apiInitPromise[0] = new Promise(resolve => {
      global.lx.apiInitPromise[1] = false
      global.lx.apiInitPromise[2] = (result: boolean) => {
        global.lx.apiInitPromise[1] = true
        resolve(result)
      }
    })
  }
  if (/^user_api/.test(apiId)) {
    // 旧主源如果既不是新的主源、也不在备用列表里，切走后释放它的脚本上下文
    if (/^user_api/.test(prevApiId) && prevApiId != apiId && !getUserApiFallbacksSync().includes(prevApiId)) {
      destroyUserApi(prevApiId)
    }
    setUserApi(apiId).catch(err => {
      if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](false)
      console.log(err)
      let api = apiSourceInfo.find(api => !api.disabled)
      if (!api) return
      if (api.id != settingState.setting['common.apiSource']) setApiSource(api.id)
    })
  } else {
    // @ts-expect-error
    global.lx.qualityList = musicSdk.supportQuality[apiId] ?? {}
    // 【改造】只销毁切换前的那个自定义源，备用源需要保留
    if (/^user_api/.test(prevApiId)) destroyUserApi(prevApiId)
    if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](true)
    // apiSource.value = apiId
    // void setUserApiAction(apiId)
  }

  if (apiId != settingState.setting['common.apiSource']) {
    updateSetting({ 'common.apiSource': apiId })
    requestAnimationFrame(() => {
      global.state_event.apiSourceUpdated(apiId)
    })
  }
}
