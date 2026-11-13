import settingState from '@/store/setting/state'
import { isCarModeEnabled } from '@/config/carMode'
import { getRandom } from '@/utils/common'
import { toast } from '@/utils/tools'

/**
 * 【v42】打开歌单自动起播。
 *
 * 设置项 list.isAutoPlayOnOpen：off 不自动（默认）/ first 第一首 / random 随机一首。
 * 车机模式下 off 会按「随机一首」兜底（上车选好歌单自动开播）。
 * 同一歌单（key）在一次应用运行期内只自动起播一次，页面往返不重复触发。
 */

const playedKeys = new Set<string>()

export const autoPlayOnListOpen = (key: string, list: readonly LX.Music.MusicInfo[], play: (index: number) => void) => {
  const setting = settingState.setting['list.isAutoPlayOnOpen']
  const effective = setting == 'off' && isCarModeEnabled() ? 'random' : setting
  if (effective == 'off') return
  if (!list?.length) return
  if (playedKeys.has(key)) return
  playedKeys.add(key)

  const index = effective == 'random' ? getRandom(0, list.length) : 0
  play(index)
  toast(global.i18n.t('auto_play_on_open_tip'))
}
