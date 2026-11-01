import apiSourceInfo from './api-source-info'

// import temp_api_kw from './kw/api-temp'
// import test_api_kg from './kg/api-test'
// import test_api_kw from './kw/api-test'
// import test_api_tx from './tx/api-test'
// import test_api_wy from './wy/api-test'
// import test_api_mg from './mg/api-test'

// import direct_api_kg from './kg/api-direct'
// import direct_api_kw from './kw/api-direct'
// import direct_api_tx from './tx/api-direct'
// import direct_api_wy from './wy/api-direct'
// import direct_api_mg from './mg/api-direct'

import settingState from '@/store/setting/state'


const apiList = {
  // temp_api_kw,
  // // test_api_bd: require('./bd/api-test'),
  // test_api_kg,
  // test_api_kw,
  // test_api_tx,
  // test_api_wy,
  // test_api_mg,
  // direct_api_kg,
  // direct_api_kw,
  // direct_api_tx,
  // direct_api_wy,
  // direct_api_mg,
  // test_api_tx: require('./tx/api-test'),
  // test_api_wy: require('./wy/api-test'),
  // test_api_xm: require('./xm/api-test'),
}
const supportQuality = {}

for (const api of apiSourceInfo) {
  supportQuality[api.id] = api.supportQualitys
  // for (const source of Object.keys(api.supportQualitys)) {
  //   const path = `./${source}/api-${api.id}`
  //   console.log(path)
  //   apiList[`${api.id}_api_${source}`] = path
  // }
}

const getAPI = source => apiList[`${settingState.setting['common.apiSource']}_api_${source}`]

/**
 * 【改造】当前正在被「强制指定」的自定义源 id。
 *
 * 备用源重试时需要让 apis() 返回备用源的实现，但又不能改动用户勾选的主源，
 * 所以用一个临时的覆盖值：只在调用 getMusicUrl 的瞬间生效（apis() 是同步求值的），
 * 拿到 api 对象后即可还原，不会影响其它并行的请求。
 */
let apiOverrideId = null

// 同步地在指定源的上下文中执行回调
export const runWithApi = (apiId, fn) => {
  const prev = apiOverrideId
  apiOverrideId = apiId || null
  try {
    return fn()
  } finally {
    apiOverrideId = prev
  }
}

const getApiId = () => apiOverrideId ?? settingState.setting['common.apiSource']

/**
 * 获取指定源的音质表。apiId 为空时返回当前主源的音质表。
 */
export const getQualityList = apiId => {
  if (!apiId) return global.lx.qualityList
  return global.lx.apisMap?.[apiId]?.qualityList ?? {}
}

const apis = source => {
  const apiId = getApiId()
  if (/^user_api/.test(apiId)) {
    const target = global.lx.apisMap?.[apiId]
    const api = target?.apis?.[source] ??
      // 兼容：主源初始化时仍会写一份到 global.lx.apis
      (apiId == settingState.setting['common.apiSource'] ? global.lx.apis[source] : null)
    if (api) return api
    throw new Error(`Api is not found: ${apiId}`)
  }
  const api = getAPI(source)
  if (api) return api
  throw new Error('Api is not found')
}

export { apis, supportQuality }
