import { useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'

type Mode = LX.AppSetting['list.isAutoPlayOnOpen']

/**
 * 【v42】打开歌单时自动起播：不自动 / 第一首 / 随机一首。
 * 车机模式下"不自动"会按"随机一首"兜底。
 */
export default () => {
  const t = useI18n()
  const theme = useTheme()
  const mode = useSettingValue('list.isAutoPlayOnOpen')
  const [picked, setPicked] = useState<Mode>(mode)
  const dialogRef = useRef<DialogType>(null)

  const modeLabel = (m: Mode) => {
    switch (m) {
      case 'first': return t('setting_list_auto_play_first')
      case 'random': return t('setting_list_auto_play_random')
      default: return t('setting_list_auto_play_off')
    }
  }

  return (
    <SubTitle title={t('setting_list_auto_play')}>
      <TouchableOpacity onPress={() => { setPicked(mode); dialogRef.current?.setVisible(true) }}>
        <Text size={14} color={theme['c-primary-font']}>{modeLabel(mode)}</Text>
      </TouchableOpacity>

      <Dialog ref={dialogRef} title={t('setting_list_auto_play')} width={340}>
        <View style={styles.optionBox}>
          {(['off', 'first', 'random'] as const).map(m => (
            <TouchableOpacity
              key={m}
              style={{ ...styles.optionBtn, backgroundColor: picked == m ? theme['c-primary-background-active'] : theme['c-button-background'] }}
              onPress={() => { setPicked(m) }}
            >
              <Text style={{ color: picked == m ? theme['c-primary-font'] : theme['c-button-font'] }}>
                {modeLabel(m)}{picked == m ? ` · ${t('roam_mode_current')}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={{ ...styles.optionBtn, backgroundColor: theme['c-primary'] }}
            onPress={() => {
              updateSetting({ 'list.isAutoPlayOnOpen': picked })
              dialogRef.current?.setVisible(false)
            }}
          >
            <Text style={{ color: theme['c-primary-font'] }}>{t('confirm')}</Text>
          </TouchableOpacity>
        </View>
      </Dialog>
    </SubTitle>
  )
}

const styles = createStyle({
  optionBox: {
    paddingTop: 6,
    gap: 10,
  },
  optionBtn: {
    borderRadius: 6,
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'center',
  },
})
