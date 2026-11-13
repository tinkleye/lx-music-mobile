import { memo, useMemo } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

type Mode = LX.AppSetting['list.isAutoPlayOnOpen']

const LIST = [
  { mode: 'off', name: 'setting_list_auto_play_off' },
  { mode: 'first', name: 'setting_list_auto_play_first' },
  { mode: 'random', name: 'setting_list_auto_play_random' },
] as const

/**
 * 【v42】打开歌单自动播放：不自动 / 第一首 / 随机一首。
 * 车机模式下"不自动"会按"随机一首"兜底（逻辑在 utils/autoPlayOnOpen.ts）。
 * 【v44】改为平铺勾选单选（参考 DrawerLayoutPosition），去掉弹窗。
 */
const Item = ({ mode, label }: { mode: Mode, label: string }) => {
  const isActive = useSettingValue('list.isAutoPlayOnOpen') == mode
  return <CheckBox marginRight={8} check={isActive} label={label} onChange={() => { updateSetting({ 'list.isAutoPlayOnOpen': mode }) }} need />
}

export default memo(() => {
  const t = useI18n()
  const list = useMemo(() => LIST.map(item => ({ mode: item.mode, name: t(item.name) })), [t])
  return (
    <SubTitle title={t('setting_list_auto_play')}>
      <View style={styles.list}>
        {list.map(({ mode, name }) => <Item key={mode} mode={mode} label={name} />)}
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
