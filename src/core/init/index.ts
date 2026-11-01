import { initSetting, showPactModal } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import dataInit from './dataInit'
import initSync from './sync'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { setApiSource } from '@/core/apiSource'
import commonActions from '@/store/common/action'
import settingState from '@/store/setting/state'
import { checkUpdate } from '@/core/version'
import { bootLog } from '@/utils/bootLog'
import { applyFullscreenSetting } from '@/core/fullscreen'
import { checkUserApiUpdates } from '@/core/userApi'
import { cheatTip, toast } from '@/utils/tools'

let isFirstPush = true
const handlePushedHomeScreen = async() => {
  await cheatTip()
  if (settingState.setting['common.isAgreePact']) {
    if (isFirstPush) {
      isFirstPush = false
      void checkUpdate()
      void initDeeplink()
    }
  } else {
    if (isFirstPush) isFirstPush = false
    showPactModal()
  }
}

let isInited = false
export default async() => {
  if (isInited) return handlePushedHomeScreen
  bootLog('Initing...')
  commonActions.setFontSize(global.lx.fontSize)
  bootLog('Font size changed.')
  const setting = await initSetting()
  bootLog('Setting inited.')

  // 【改造】按「车机模式」应用全屏（原生默认全屏，车机模式关闭时这里把系统栏还原）
  applyFullscreenSetting()
  bootLog('Fullscreen applied.')
  // console.log(setting)

  await initTheme(setting)
  bootLog('Theme inited.')
  await initI18n(setting)
  bootLog('I18n inited.')

  await initUserApi(setting)
  bootLog('User Api inited.')

  setApiSource(setting['common.apiSource'])
  bootLog('Api inited.')

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  await initPlayer(setting)
  bootLog('Player inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  await initCommonState(setting)
  bootLog('Common State inited.')

  void initSync(setting)
  bootLog('Sync inited.')

  // 【改造】启动后延迟检查自定义源更新（只处理记录过来源地址的源）
  if (setting['common.autoUpdateUserApi']) {
    setTimeout(() => {
      void checkUserApiUpdates().then(result => {
        if (result.updated) toast(global.i18n.t('user_api_check_update_success', { count: result.updated }))
      }).catch(err => {
        console.log(err)
      })
    }, 5000)
  }

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
