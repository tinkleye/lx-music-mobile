import { memo, useEffect, useRef, useState } from 'react'

import { View, StyleSheet, TouchableOpacity } from 'react-native'

import { pop } from '@/navigation'
import StatusBar from '@/components/common/StatusBar'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import commonState from '@/store/common/state'
import SettingPopup, { type SettingPopupType } from '../../components/SettingPopup'
import { useStatusbarHeight } from '@/store/common/hook'
import Btn from './Btn'
import TimeoutExitBtn from './TimeoutExitBtn'
import { getRoamState, subscribeRoam, endRoam } from '@/core/roam'
import { toast } from '@/utils/tools'
import { useI18n } from '@/lang'

export const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)


const Title = () => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const t = useI18n()
  const [roam, setRoam] = useState(getRoamState())

  // 【v42】漫游来源胶囊：漫游中显示「漫游 · 来源」，点击结束漫游
  useEffect(() => subscribeRoam(() => { setRoam({ ...getRoamState() }) }), [])

  return (
    <View style={styles.titleContent}>
      <Text numberOfLines={1} style={styles.title}>{musicInfo.name}</Text>
      <View style={styles.subRow}>
        <Text numberOfLines={1} style={styles.title} size={12} color={theme['c-font-label']}>{musicInfo.singer}</Text>
        {
          roam.active ? (
            <TouchableOpacity
              style={{ ...styles.roamBadge, backgroundColor: theme['c-primary-light-100-alpha-700'] }}
              onPress={() => {
                void endRoam()
                toast(t('roam_ended_tip'))
              }}
            >
              <Text size={10} color={theme['c-primary-font']} numberOfLines={1}>
                {t('roam_source_badge', { source: roam.sourceDesc })}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      </View>
    </View>
  )
}

export default memo(() => {
  const popupRef = useRef<SettingPopupType>(null)
  const statusBarHeight = useStatusbarHeight()

  const back = () => {
    void pop(commonState.componentIds.playDetail!)
  }
  const showSetting = () => {
    popupRef.current?.show()
  }

  return (
    <View style={{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}>
      <StatusBar />
      <View style={styles.container}>
        <Btn icon="chevron-left" onPress={back} />
        <Title />
        <TimeoutExitBtn />
        <Btn icon="slider" onPress={showSetting} />
      </View>
      <SettingPopup ref={popupRef} direction="vertical" />
    </View>
  )
})


const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    // justifyContent: 'center',
    height: '100%',
  },
  titleContent: {
    flex: 1,
    paddingHorizontal: 5,
    // alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    // flex: 1,
    // textAlign: 'center',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  roamBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 160,
    flexShrink: 1,
  },
  icon: {
    paddingLeft: 4,
    paddingRight: 4,
  },
})
