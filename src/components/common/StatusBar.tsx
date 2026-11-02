import { useTheme } from '@/store/theme/hook'
import { StatusBar as RNStatusBar } from 'react-native'
import { isFullscreenEnabled } from '@/config/fullscreen'

const StatusBar = function() {
  const theme = useTheme()
  const statusBarStyle = theme.isDark ? 'light-content' : 'dark-content'
  // 【改造】全屏（车机模式）下必须显式传 hidden。
  //
  // React Native 的 StatusBar 组件内置默认值是 hidden: false，而且只要组件挂载，
  // 它就会把这套默认属性推给原生（setHidden(false)），那一步会
  // clearFlags(FLAG_FULLSCREEN) —— 车机上判断"要不要显示底部空调栏"看的正是这个标志。
  // 播放页里就有 <StatusBar />，所以以前是"首页好好的，一点播放页空调栏就冒出来"。
  // 这里传 true 之后，挂载动作反而会帮我们把全屏标志补上，与原生守护形成双重保险。
  return (
    <RNStatusBar
      hidden={isFullscreenEnabled()}
      backgroundColor="rgba(0,0,0,0)"
      barStyle={statusBarStyle}
      translucent={true}
    />
  )
}

StatusBar.currentHeight = RNStatusBar.currentHeight ?? 0
StatusBar.setBarStyle = RNStatusBar.setBarStyle

export default StatusBar
