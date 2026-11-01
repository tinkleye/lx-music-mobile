import { memo, useEffect } from 'react'
import { View, AppState } from 'react-native'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import StatusBar from '@/components/common/StatusBar'
import MoreBtn from './MoreBtn'

import Header, { HEADER_HEIGHT } from './components/Header'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import PageContent from '@/components/PageContent'
import commonState, { type InitState as CommonState } from '@/store/common/state'

import Pic from './Pic'
// import ControlBtn from './ControlBtn'
import Lyric from './Lyric'
import Player from './Player'
import { createStyle } from '@/utils/tools'
import { marginLeftRaw } from './constant'
import { useStatusbarHeight } from '@/store/common/hook'
import { useWindowSize } from '@/utils/hooks'
import { CAR, isCarModeEnabled } from '@/config/carMode'
import { BTN_WIDTH } from './MoreBtn/Btn'
// import MoreBtn from './MoreBtn2'

// 【改造】车机模式：超宽屏（如 1920x720）下原来的左右两栏会把内容拉得很散，
// 改成「封面 | 信息与控制 | 歌词」三栏，封面能用满高度，控制按钮也能放大。
const carMode = isCarModeEnabled()

export default memo(({ componentId }: { componentId: string }) => {
  const statusBarHeight = useStatusbarHeight()
  const { width: winWidth, height: winHeight } = useWindowSize()

  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
    screenkeepAwake()
    let appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (!commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (AppState.currentState == 'active') screenkeepAwake()
    }

    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)

    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      appstateListener.remove()
      screenUnkeepAwake()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (carMode) {
    // 封面按可用高度算成正方形，同时不超过屏幕宽度的 26%，剩下的宽度留给歌词
    const coverSize = Math.min(
      winHeight - statusBarHeight - HEADER_HEIGHT - 30,
      winWidth * 0.26,
    )
    return (
      <PageContent>
        <StatusBar />
        <View style={{ flex: 1, paddingTop: statusBarHeight }}>
          <Header />
          <View style={styles.carBody}>
            <View style={{ ...styles.carCover, width: coverSize + BTN_WIDTH + 20 }}>
              <MoreBtn />
              <Pic componentId={componentId} carWidth={coverSize} />
            </View>
            <View style={styles.carMiddle}>
              <Player />
            </View>
            <View style={{ ...styles.carLyric, width: Math.min(winWidth * 0.4, CAR.lyricMaxWidth) }}>
              <Lyric />
            </View>
          </View>
        </View>
      </PageContent>
    )
  }

  return (
    <PageContent>
      <StatusBar />
      <View style={{ ...styles.container, paddingTop: statusBarHeight }}>
        <View style={styles.left}>
          <Header />
          <View style={styles.leftContent}>
            <MoreBtn />
            <Pic componentId={componentId} />
          </View>
          <Player />
          {/* <View style={styles.controlBtn} nativeID="pageIndicator">
            <MoreBtn />
            <ControlBtn />
          </View> */}
        </View>
        <View style={styles.right}>
          <Lyric />
        </View>
      </View>
    </PageContent>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  // 【改造】车机模式三栏容器
  carBody: {
    flex: 1,
    flexDirection: 'row',
    paddingBottom: 10,
  },
  carCover: {
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    // 给左侧浮动的「更多」按钮让出位置，避免压住封面
    // 注意这里写原始值 32，createStyle 会再按屏幕缩放一次，和 MoreBtn 的宽度一致
    paddingLeft: 32,
  },
  carMiddle: {
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: 12,
  },
  carLyric: {
    flexGrow: 0,
    flexShrink: 0,
  },
  left: {
    flex: 1,
    width: '45%',
    paddingBottom: 10,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  leftContent: {
    flexShrink: 1,
    flexGrow: 0,
    marginLeft: marginLeftRaw,
    // flexDirection: 'row',
    // backgroundColor: 'rgba(0,0,0,0.1)',
    // alignItems: 'center',
  },
  right: {
    width: '55%',
    flexGrow: 0,
    flexShrink: 0,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // backgroundColor: '#eee',
  },
})
