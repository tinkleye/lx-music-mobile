import settingState from '@/store/setting/state'
import { addDownloadTasks } from '@/core/downloadQueue'
import { requestStoragePermission, toast } from '@/utils/tools'

/**
 * 【v42】下载请求入口。
 *
 * - 设置「下载前总是询问音质」开启 → 返回 false，由调用方弹出音质选择弹窗；
 * - 关闭（默认）→ 直接按播放音质（源不支持时自动降级）加入下载队列并 toast 提示，
 *   返回 true 表示已处理。
 */
export const requestDownload = (musicInfo: LX.Music.MusicInfo, selectedList?: LX.Music.MusicInfo[]): boolean => {
  if (settingState.setting['download.isAskQuality']) return false

  const list = (selectedList?.length ? selectedList : [musicInfo]).filter(m => m.source != 'local')
  if (!list.length) return true

  void (async() => {
    // 没给权限也不拦着：公共目录写不进去时会自动退到 App 私有目录
    const granted = await requestStoragePermission()
    if (granted === false) toast(global.i18n.t('download_permission_fallback'))
    const { added, skipped } = addDownloadTasks(list)
    if (added) toast(global.i18n.t('download_queued_toast', { count: added, skipped }))
    else toast(global.i18n.t('download_queued_skip_only', { count: skipped }))
  })()
  return true
}
