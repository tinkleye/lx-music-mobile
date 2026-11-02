import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { createStyle } from '@/utils/tools'

import LeftBar, { type LeftBarType, type LeftBarProps } from './LeftBar'
import MusicList, { type MusicListType } from '../MusicList'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import { isCarModeEnabled } from '@/config/carMode'
// import { BorderWidths } from '@/theme'
// import { useTheme } from '@/store/theme/hook'

// 【改造】右侧安全边距
//
// 歌曲行最右边是「⋮」更多菜单按钮。原来列表一直铺到屏幕物理边缘，
// 车机屏幕边缘常被边框、圆角或系统手势区占掉一部分，手指点不准，
// 表现为"按钮贴边、很难点中"。
// 这里给整个页面留一条右侧留白，内容整体左缩进：
// 车机屏幕大、点按精度差，留宽一点；手机保持很小的一点点。
const CONTENT_PADDING_RIGHT = isCarModeEnabled() ? 18 : 4


export default () => {
  const leftBarRef = useRef<LeftBarType>(null)
  const musicListRef = useRef<MusicListType>(null)
  const isUnmountedRef = useRef(false)
  // const theme = useTheme()

  const handleChangeBound: LeftBarProps['onChangeList'] = (source, id) => {
    musicListRef.current?.loadList(source, id)
    void saveLeaderboardSetting({
      source,
      boardId: id,
    })
  }

  useEffect(() => {
    isUnmountedRef.current = false
    void getLeaderboardSetting().then(({ source, boardId }) => {
      leftBarRef.current?.setBound(source, boardId)
      musicListRef.current?.loadList(source, boardId)
    })

    return () => {
      isUnmountedRef.current = true
    }
  }, [])


  return (
    <View style={styles.container}>
      <LeftBar
        ref={leftBarRef}
        onChangeList={handleChangeBound}
      />
      <MusicList
        ref={musicListRef}
      />
    </View>
  )
}

const styles = createStyle({
  container: {
    width: '100%',
    flex: 1,
    flexDirection: 'row',
    // 【改造】整体左缩进，避免最右侧的「⋮」按钮贴在屏幕物理边缘
    paddingRight: CONTENT_PADDING_RIGHT,
    // borderTopWidth: BorderWidths.normal,
  },
  content: {
    flex: 1,
  },
})
