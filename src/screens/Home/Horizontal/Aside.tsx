import { memo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { confirmDialog, createStyle, exitApp as backHome } from '@/utils/tools'
import { NAV_MENUS } from '@/config/constant'
import type { InitState } from '@/store/common/state'
// import commonState from '@/store/common/state'
import { exitApp, setNavActiveId } from '@/core/common'
import { BorderWidths } from '@/theme'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { CAR, isCarModeEnabled } from '@/config/carMode'
import { scaleSizeH } from '@/utils/pixelRatio'

// 【改造】车机模式下导航栏加宽，塞得下「图标 + 文字」
const carMode = isCarModeEnabled()
const NAV_WIDTH = carMode ? CAR.navWidth : 68
const ICON_SIZE = carMode ? CAR.navIconSize : 20
const ITEM_PADDING_V = carMode ? CAR.navItemPaddingV : 15

/**
 * 【改造】播放栏（右侧底部那一条）的实际高度。
 *
 * 计算方式必须和 PlayerBar 保持一致：封面 scaleSizeH(46) + 上下 padding 各 5。
 * 车机模式下底部的「首页 / 退出应用」按钮要和它等高，两个区域的底边才会
 * 落在同一条水平线上，否则导航栏最下面那块看起来"比播放栏高出一截"。
 *
 * 注意：这个值已经换算过，使用时要用 inline style，不能再过 createStyle。
 */
const PLAYER_BAR_HEIGHT = scaleSizeH(46) + scaleSizeH(5) * 2

const styles = createStyle({
  container: {
    flexGrow: 0,
    // flex: 1,
    // alignItems: 'center',
    // justifyContent: 'center',
    // padding: 10,
    borderRightWidth: BorderWidths.normal,
    paddingBottom: 10,
    width: NAV_WIDTH,
  },
  header: {
    paddingTop: 15,
    paddingBottom: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    textAlign: 'center',
    marginLeft: 16,
  },
  menus: {
    flex: 1,
  },
  list: {
    // paddingTop: 10,
    paddingBottom: 15,
  },
  menuItem: {
    flexDirection: 'row',
    paddingTop: ITEM_PADDING_V,
    paddingBottom: ITEM_PADDING_V,
    // paddingLeft: 25,
    // paddingRight: 25,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  iconContent: {
    // width: 24,
    // backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
  },
  text: {
    paddingLeft: 15,
    // fontWeight: '500',
  },
  label: {
    marginTop: 3,
    textAlign: 'center',
  },
  // 【改造】车机模式下的底栏：与右侧播放栏等高，两个按钮平分宽度
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  bottomItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

const Header = ({ onBeforeNavigate }: { onBeforeNavigate?: () => void }) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  return (
    <View style={{ paddingTop: statusBarHeight }}>
      <View style={styles.header}>
        {/* 【v33】logo 可点：点击进入驾驶页（驾驶页不再占导航栏图标）；
            【v50】播放页里复用时也要先退出播放页，否则驾驶舱被播放页盖住看不到 */}
        <TouchableOpacity onPress={() => { onBeforeNavigate?.(); setNavActiveId('nav_drive') }} activeOpacity={0.7}>
          <Icon name="logo" color={theme['c-primary-dark-100-alpha-300']} size={22} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

type IdType = InitState['navActiveId'] | 'nav_exit' | 'back_home'

const MenuItem = ({ id, icon, onPress, clickableActive = false, compact = false }: {
  id: IdType
  icon: string
  onPress: (id: IdType) => void
  // 【改造】在播放页复用导航栏时，当前项也要可点（用来退出播放页回主页）
  clickableActive?: boolean
  /**
   * 【改造】底栏紧凑模式：只显示图标、与相邻按钮平分宽度。
   * 用在车机模式底部的「首页 / 退出应用」上 —— 那里宽度只有半个导航栏，
   * 放不下「图标 + 文字」两行，而且整块高度必须压到与播放栏一致。
   */
  compact?: boolean
}) => {
  const t = useI18n()
  const activeId = useNavActiveId()
  const theme = useTheme()
  const isActive = activeId == id

  const iconColor = isActive ? theme['c-primary-font-active'] : theme['c-font-label']
  const iconEl = <Icon name={icon} size={ICON_SIZE} color={iconColor} />

  // 【改造】车机模式下图标下面补一行文字，行车时不用猜图标含义
  const content = compact
    ? iconEl
    : (
        <View style={styles.iconContent}>
          {iconEl}
          {
            carMode
              ? <Text
                  style={styles.label}
                  size={CAR.navLabelSize}
                  numberOfLines={1}
                  color={iconColor}
                >{t(id)}</Text>
              : null
          }
        </View>
      )

  const itemStyle = compact ? [styles.menuItem, styles.bottomItem] : styles.menuItem

  return isActive && !clickableActive
    ? <View style={itemStyle}>{content}</View>
    : <TouchableOpacity style={itemStyle} onPress={() => { onPress(id) }}>{content}</TouchableOpacity>
}

export interface AsideProps {
  /**
   * 【改造】在播放页里也复用这条导航栏时，点击菜单需要先退出播放页，
   * 再切换 Home 的导航项，否则用户看不到任何变化（Home 被播放页盖住）。
   */
  onBeforeNavigate?: () => void
}

export default memo(({ onBeforeNavigate }: AsideProps) => {
  const theme = useTheme()
  // console.log('render drawer nav')
  const showBackBtn = useSettingValue('common.showBackBtn')
  const showExitBtn = useSettingValue('common.showExitBtn')

  const handlePress = (id: IdType) => {
    switch (id) {
      case 'nav_exit':
        void confirmDialog({
          message: global.i18n.t('exit_app_tip'),
          confirmButtonText: global.i18n.t('list_remove_tip_button'),
        }).then(isExit => {
          if (!isExit) return
          exitApp('Exit Btn')
        })
        return
      case 'back_home':
        backHome()
        return
    }

    // 先退出播放页（若当前不在 Home），再切换导航项
    onBeforeNavigate?.()
    global.app_event.changeMenuVisible(false)
    setNavActiveId(id)
  }

  return (
    <View
      style={{
        ...styles.container,
        borderRightColor: theme['c-border-background'],
        // 【改造】车机模式下底部按钮要和播放栏对齐，这里不能再留额外内边距
        paddingBottom: carMode ? 0 : styles.container.paddingBottom,
      }}
    >
      <Header onBeforeNavigate={onBeforeNavigate} />
      <ScrollView style={styles.menus}>
        <View style={styles.list}>
          {NAV_MENUS.map(menu => <MenuItem key={menu.id} id={menu.id} icon={menu.icon} onPress={handlePress} clickableActive={!!onBeforeNavigate} />)}
        </View>
      </ScrollView>
      {
        // 【改造】车机模式：底部两个按钮横排、整块高度与右侧播放栏一致，
        // 这样导航栏最下面和播放栏落在同一条水平线上。
        // 每个按钮只剩半个导航栏的宽度（约 37dp），放不下两行文字，
        // 所以只显示图标。
        carMode
          ? (
              (showBackBtn || showExitBtn) ? (
                <View style={{ ...styles.bottomBar, height: PLAYER_BAR_HEIGHT }}>
                  {showBackBtn ? <MenuItem id="back_home" icon="home" onPress={handlePress} compact /> : null}
                  {showExitBtn ? <MenuItem id="nav_exit" icon="exit2" onPress={handlePress} compact /> : null}
                </View>
              ) : null
            )
          : (
              <>
                {showBackBtn ? <MenuItem id="back_home" icon="home" onPress={handlePress} /> : null}
                {showExitBtn ? <MenuItem id="nav_exit" icon="exit2" onPress={handlePress} /> : null}
              </>
            )
      }
    </View>
  )
})
