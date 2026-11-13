import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import settingState from '@/store/setting/state'
import MusicList from './MusicList'
import MyList from './MyList'
import { useTheme } from '@/store/theme/hook'
import DrawerLayoutFixed, { type DrawerLayoutFixedType } from '@/components/common/DrawerLayoutFixed'
import { COMPONENT_IDS } from '@/config/constant'
import { scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { useHorizontalMode } from '@/utils/hooks'
import type { InitState as CommonState } from '@/store/common/state'

// 【v48】按横竖屏切换布局（与排行榜一致）：横屏=常驻左栏双栏，竖屏=抽屉一栏+点击划出列表栏
const MAX_WIDTH = scaleSizeW(400)

export default () => {
  const drawer = useRef<DrawerLayoutFixedType>(null)
  const theme = useTheme()
  const isHorizontalMode = useHorizontalMode()
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

  // 【v48】横屏：固定左右两栏 —— 左栏是所有列表，右栏是当前列表的歌曲。
  // 竖屏：抽屉一栏，点击顶部列表名从左边划出列表栏（与排行榜一致）。
  if (isHorizontalMode) {
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
