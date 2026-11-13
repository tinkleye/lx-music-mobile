import { useEffect, useState } from 'react'
import { TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'

/**
 * 【v44】竖屏本地音乐：顶部标题栏右侧的「歌曲下载」入口。
 * 点击切换下载页显示，进入下载页后按钮切换为「返回」。
 * 通过全局事件与 LocalMusic 双向同步显示状态。
 */
export default () => {
  const theme = useTheme()
  const t = useI18n()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onChanged = (s: boolean) => { setShow(s) }
    global.app_event.on('localDownloadStateChanged', onChanged)
    return () => { global.app_event.off('localDownloadStateChanged', onChanged) }
  }, [])

  const toggle = () => {
    global.app_event.toggleLocalDownload()
  }

  return (
    <TouchableOpacity style={styles.entry} onPress={toggle}>
      <Icon name={show ? 'chevron-left' : 'download-2'} size={16} color={theme['c-primary']} />
      <Text size={13} color={theme['c-primary']} numberOfLines={1}>{show ? t('back') : t('download_entry')}</Text>
    </TouchableOpacity>
  )
}

const styles = createStyle({
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
})
