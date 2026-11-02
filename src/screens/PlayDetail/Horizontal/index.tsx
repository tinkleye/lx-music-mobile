import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View, AppState, Pressable, StyleSheet } from 'react-native'
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
import CarPlayList from './CarPlayList'
import CarImmersiveLyric from './CarImmersiveLyric'
import Aside from '@/screens/Home/Horizontal/Aside'
import { pop } from '@/navigation'
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
  // 【改造】车机模式：左栏是否显示「当前播放列表」（默认显示播放界面）
  const [showPlayList, setShowPlayList] = useState(false)
  // 【改造】沉浸式歌词：双击右侧歌词区进入，整屏只留当前这一句
  const [immersive, setImmersive] = useState(false)
  const lastLyricTapRef = useRef(0)
  const showPlayListPanel = useCallback(() => { setShowPlayList(true) }, [])
  const closePlayListPanel = useCallback(() => { setShowPlayList(false) }, [])
  const closeImmersive = useCallback(() => { setImmersive(false) }, [])
  // 双击判定：两次抬起间隔小于 320ms 视为双击。
  // 用父容器的 onTouchEnd 而不是盖一层遮罩，这样歌词滚动、点击歌词跳转进度都还能用
  const handleLyricTouchEnd = useCallback(() => {
    if (showPlayList) return
    const now = Date.now()
    if (now - lastLyricTapRef.current < 320) {
      lastLyricTapRef.current = 0
      setImmersive(true)
      return
    }
    lastLyricTapRef.current = now
  }, [showPlayList])
  // 播放页里点击左侧导航：先退出播放页，导航栏那边再切换栏目
  const handleAsideNavigate = useCallback(() => {
    setShowPlayList(false)
    const id = commonState.componentIds.playDetail
    if (id) void pop(id)
  }, [])

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
    // 【改造】车机模式：左侧常驻导航栏 + 播放区 + 歌词
    // 左栏：默认显示封面(黑胶)/歌名/进度条/大播放按钮，点「播放列表」按钮时换成当前播放队列
    const contentH = winHeight - statusBarHeight - HEADER_HEIGHT
    const coverSize = Math.min(contentH * 0.32, winWidth * 0.15, 300)
    return (
      <PageContent>
        <StatusBar />
        <View style={{ flex: 1, paddingTop: statusBarHeight, flexDirection: 'row' }}>
          <Aside onBeforeNavigate={handleAsideNavigate} />
          <View style={styles.carBody}>
            <View style={styles.carLeft}>
              {
                showPlayList
                  ? <CarPlayList onClose={closePlayListPanel} />
                  : <CarPlayer coverSize={coverSize} onShowPlayList={showPlayListPanel} />
              }
            </View>
            <View style={styles.carLyric} onTouchEnd={handleLyricTouchEnd}>
              <Lyric />
              {
                // 【改造】播放列表打开时，点右侧空白区域（歌词区）即可收起面板
                showPlayList
                  ? <Pressable style={StyleSheet.absoluteFill} onPress={closePlayListPanel} />
                  : null
              }
            </View>
          </View>
          {
            // 【改造】沉浸式歌词：盖在整页最上层（连带左侧导航栏一起盖住），
            // 双击空白处返回，长按调出设置
            immersive ? <CarImmersiveLyric onClose={closeImmersive} /> : null
          }
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
