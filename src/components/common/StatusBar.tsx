import { StatusBar as RNStatusBar } from 'react-native'

/**
 * 【改造】这个组件只保留 API 兼容，不再渲染任何内容。
 *
 * 原因：React Native 的 StatusBar 组件内部维护一个「属性栈」：
 *   - 挂载时把 hidden 推给原生
 *   - 【关键】卸载时会把该实例从栈里移除；如果栈空了，就用默认值
 *     （hidden: false、translucent: false）再推一次原生
 *
 * 而 setHidden(false) 在 Android 侧会 clearFlags(FLAG_FULLSCREEN)，
 * 车机判断要不要弹出底部空调栏看的正是这个标志。
 * 所以每次页面切换（播放页、首页的 StatusBar 组件卸载 / 重新挂载）都会
 * 闪一下空调栏 —— 只改 hidden 属性治不了，因为卸载路径由 RN 内部决定。
 *
 * 沉浸式全屏现在完全由原生层（MainActivity）负责：
 * FLAG_FULLSCREEN + SYSTEM_UI_FLAG_IMMERSIVE_STICKY 一直守护，
 * JS 层不需要、也不应该再插手状态栏显隐。
 *
 * 因此这里直接返回 null，只保留静态方法给业务代码调用。
 * 其中 setBarStyle 走的是原生 setStyle，只改图标颜色，不涉及 hidden，安全。
 */
const StatusBar = function() {
  return null
}

StatusBar.currentHeight = RNStatusBar.currentHeight ?? 0
StatusBar.setBarStyle = RNStatusBar.setBarStyle

export default StatusBar
