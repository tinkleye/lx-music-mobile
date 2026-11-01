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
import CarPlayer from './CarPlayer'
import { createStyle } from '@/utils/tools'
import { marginLeftRaw } from './constant'
import { useStatusbarHeight } from '@/store/common/hook'
import { useWindowSize } from '@/utils/hooks'
import { isCarModeEnabled } from '@/config/carMode'
// import MoreBtn from './MoreBtn2'

// 【改造】车机模式：超宽屏（如 1920x720）下改为左右两栏布局，
// 左栏封面+信息+控制，右栏歌词，参考车机 App 常见样式。
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
    // 【改造】车机模式：参考车机 App 截图改为左右两栏
    // 左栏：封面(黑胶) + 歌名收藏 + 进度条 + 大播放按钮；右栏：歌词
    const contentH = winHeight - statusBarHeight - HEADER_HEIGHT
    const coverSize = Math.min(contentH * 0.32, winWidth * 0.15, 300)
    return (
      <PageContent>
        <StatusBar />
        <View style={{ flex: 1, paddingTop: statusBarHeight }}>
          <View style={styles.carBody}>
            <View style={styles.carLeft}>
              <CarPlayer coverSize={coverSize} />
            </View>
            <View style={styles.carLyric}>
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
  // 【改造】车机模式左右两栏容器
  carBody: {
    flex: 1,
    flexDirection: 'row',
  },
  carLeft: {
    width: '46%',
    flexGrow: 0,
    flexShrink: 0,
    paddingBottom: 10,
  },
  carLyric: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 6,
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
