import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { confirmDialog, toast, createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import playerState from '@/store/player/state'
import { blockCurrentSinger } from '@/core/player/player'

/**
 * 【v42】屏蔽该歌手：不再播放该歌手的所有歌曲（含合唱），歌单内容不删除。
 * 【v45】图标从 close 改为「爱心 + 斜杠」组合，竖屏/横屏共用（size 自适应）。
 */
export default ({ size = 22 }: { size?: number }) => {
  const t = useI18n()
  const theme = useTheme()

  const handleBlock = async() => {
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (!musicInfo || 'progress' in musicInfo) return
    const name = musicInfo.singer ?? ''
    if (!name) return
    const confirmed = await confirmDialog({
      title: t('block_singer_confirm_title'),
      message: t('block_singer_confirm_content', { singer: name }),
      confirmButtonText: t('block_singer_confirm_btn'),
    })
    if (!confirmed) return
    await blockCurrentSinger()
    toast(t('block_singer_done_tip', { singer: name }))
  }

  const slashLen = size * 1.2
  const slashThick = Math.max(1.5, size * 0.14)

  return (
    <TouchableOpacity
      style={{ ...styles.btn, width: size * 1.6, height: size * 1.6 }}
      activeOpacity={0.5}
      onPress={() => { void handleBlock() }}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="love" color={theme['c-font-label']} size={size} />
        <View
          style={{
            position: 'absolute',
            width: slashLen,
            height: slashThick,
            borderRadius: slashThick / 2,
            backgroundColor: theme['c-content-background'],
            transform: [{ rotate: '-45deg' }],
          }} />
      </View>
    </TouchableOpacity>
  )
}

const styles = createStyle({
  btn: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
})
