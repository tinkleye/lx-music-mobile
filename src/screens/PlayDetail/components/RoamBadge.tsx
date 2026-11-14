import { memo, useEffect, useState } from 'react'
import { TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { getRoamState, subscribeRoam, startRoam, endRoam } from '@/core/roam'
import { toast } from '@/utils/tools'

/**
 * 【v55】歌曲漫游入口（横竖屏播放页 Header 共用）：
 * - 未漫游 → 显示「歌曲漫游」按钮，点击开始漫游；
 * - 漫游中 → 替换显示「漫游 · 来源」，点击结束漫游、回到按钮。
 */
export default memo(({ size = 10 }: { size?: number }) => {
  const t = useI18n()
  const theme = useTheme()
  const [roam, setRoam] = useState(getRoamState())

  useEffect(() => subscribeRoam(() => { setRoam({ ...getRoamState() }) }), [])

  const handlePress = () => {
    if (roam.active) {
      void endRoam()
      toast(t('roam_ended_tip'))
    } else {
      void startRoam()
    }
  }

  return (
    <TouchableOpacity
      style={{
        ...styles.badge,
        backgroundColor: roam.active ? theme['c-primary-light-100-alpha-700'] : theme['c-button-background'],
      }}
      onPress={handlePress}
      activeOpacity={0.6}
    >
      <Text size={size} color={roam.active ? theme['c-primary-font'] : theme['c-button-font']} numberOfLines={1}>
        {roam.active ? t('roam_source_badge', { source: roam.sourceDesc }) : t('roam_list_name')}
      </Text>
    </TouchableOpacity>
  )
})

const styles = createStyle({
  badge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 200,
    flexShrink: 1,
  },
})
