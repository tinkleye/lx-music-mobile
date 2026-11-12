import { useEffect, useRef } from 'react'
import { View, useWindowDimensions } from 'react-native'
import settingState from '@/store/setting/state'
import MusicList from './MusicList'
import MyList from './MyList'
import PortraitSelector from './PortraitSelector'
import { useTheme } from '@/store/theme/hook'
import DrawerLayoutFixed, { type DrawerLayoutFixedType } from '@/components/common/DrawerLayoutFixed'
import { COMPONENT_IDS } from '@/config/constant'
import { scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { isCarModeEnabled } from '@/config/carMode'
import type { InitState as CommonState } from '@/store/common/state'

// 【改造】车机模式：列表抽屉改成常驻左栏，不需要再点开
const carMode = isCarModeEnabled()
const MAX_WIDTH = scaleSizeW(400)

export default () => {
  const drawer = useRef<DrawerLayoutFixedType>(null)
  const theme = useTheme()
  // 【v40】方向参与布局决策：车机模式下竖屏窄屏放不下左右两栏，改单栏下拉
  const { width: winW, height: winH } = useWindowDimensions()
  const isLandscape = winW > winH
  // const [width, setWidth] = useState(0)

  useEffect(() => {
    const handleFixDrawer = (id: CommonState['navActiveId']) => {
      if (id == 'nav_love') drawer.current?.fixWidth()
    }
    const changeVisible = (visible: boolean) => {
      if (visible) {
        requestAnimationFrame(() => {
          drawer.current?.openDrawer()
        })
      } else {
        drawer.current?.closeDrawer()
      }
    }

    // setWidth(getWindowSise().width * 0.82)

    global.state_event.on('navActiveIdUpdated', handleFixDrawer)
    global.app_event.on('changeLoveListVisible', changeVisible)

    // 就放旋转屏幕后的宽度没有更新的问题
    // const changeEvent = onDimensionChange(({ window }) => {
    //   setWidth(window.width * 0.82)
    //   drawer.current?.setNativeProps({
    //     width: window.width,
    //   })
    // })

    return () => {
      global.state_event.off('navActiveIdUpdated', handleFixDrawer)
      global.app_event.off('changeLoveListVisible', changeVisible)
    // changeEvent.remove()
    }
  }, [])

  const navigationView = () => <MyList />
  // console.log('render drawer content')

  // 【改造】车机模式：固定左右两栏 —— 左栏是所有列表，右栏是当前列表的歌曲。
  // 不再用抽屉，所以点导航的「我的列表 / 我的收藏」都能直接看到全部列表。
  // 【v40】竖屏窄屏：两栏挤不下（手机上车机模式开着尤其明显），
  // 改单栏 —— 顶部歌单下拉选择器 + 下方当前列表歌曲上下滚动；
  // 横屏维持左右两栏不变。
  if (carMode) {
    if (!isLandscape) {
      return (
        <View style={styles.carPortrait}>
          <PortraitSelector />
          <View style={styles.carMain}>
            <MusicList />
          </View>
        </View>
      )
    }
    return (
      <View style={styles.carContainer}>
        <View style={{ ...styles.carListPane, borderRightColor: theme['c-border-background'] }}>
          <View style={styles.carListInner}>
            <MyList alwaysVisible />
          </View>
        </View>
        <View style={styles.carMain}>
          <MusicList />
        </View>
      </View>
    )
  }

  return (
    <DrawerLayoutFixed
      ref={drawer}
      visibleNavNames={[COMPONENT_IDS.home]}
      // drawerWidth={width}
      widthPercentage={0.82}
      widthPercentageMax={MAX_WIDTH}
      drawerPosition={settingState.setting['common.drawerLayoutPosition']}
      renderNavigationView={navigationView}
      drawerBackgroundColor={theme['c-content-background']}
      style={{ elevation: 1 }}
    >
      <MusicList />
    </DrawerLayoutFixed>
  )
}

const styles = createStyle({
  carContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  // 【v40】车机模式竖屏：单栏（顶部下拉选择器 + 歌曲列表）
  carPortrait: {
    flex: 1,
  },
  carListPane: {
    // 【改造】车机模式左栏：所有列表常驻，占屏幕宽度约四分之一
    width: '24%',
    flexGrow: 0,
    flexShrink: 0,
    borderRightWidth: BorderWidths.normal,
  },
  carListInner: {
    flex: 1,
    overflow: 'hidden',
  },
  carMain: {
    flexGrow: 1,
    flexShrink: 1,
    overflow: 'hidden',
  },
})
