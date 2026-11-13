import Btn from './Btn'
import { confirmDialog, toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import playerState from '@/store/player/state'
import { blockCurrentSinger } from '@/core/player/player'

/**
 * 【v42】屏蔽该歌手：不再播放该歌手的所有歌曲（含合唱），歌单内容不删除。
 */
export default () => {
  const t = useI18n()

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

  return <Btn icon="close" onPress={() => { void handleBlock() }} />
}
