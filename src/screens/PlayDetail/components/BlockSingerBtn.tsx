import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { confirmDialog, toast, createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import playerState from '@/store/player/state'
import { blockCurrentSinger } from '@/core/player/player'
import { scaleSizeW } from '@/utils/pixelRatio'

/**
 * 【v42】屏蔽该歌手：不再播放该歌手的所有歌曲（含合唱），歌单内容不删除。
 * 【v45】图标从 close 改为「爱心 + 斜杠」组合，竖屏/横屏共用（size 自适应）。
 * 【v48】统一用 scaleSizeW 缩放 love 图标与斜杠（原图标缩放、斜杠不缩放导致错位/显示不全）。
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

  const iconSize = scaleSizeW(size)
  // 【v49】love 字形本身占满画布（左右零留白），渲染时右端贴边被削。
  // 手动把 love 缩到容器 82% 四周留白，斜杠同步缩放，不再贴边。
  const heartSize = iconSize * 0.82
  const slashLen = heartSize * 1.25
  const slashThick = Math.max(1.2, heartSize * 0.13)

  return (
    <TouchableOpacity
      style={{ ...styles.btn, width: iconSize * 1.6, height: iconSize * 1.6 }}
      activeOpacity={0.5}
      onPress={() => { void handleBlock() }}
    >
      <View style={{ width: iconSize, height: iconSize, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="love" color={theme['c-font-label']} rawSize={heartSize} />
        <View
          style={{
            position: 'absolute',
            left: (iconSize - slashLen) / 2,
            top: (iconSize - slashThick) / 2,
            width: slashLen,
            height: slashThick,
            borderRadius: slashThick / 2,
            backgroundColor: theme['c-font-label'],
            transform: [{ rotate: '-36deg' }],
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
