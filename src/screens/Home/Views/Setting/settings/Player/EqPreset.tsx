import { memo } from 'react'
import { View, ScrollView } from 'react-native'

import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import SubTitle from '../../components/SubTitle'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { EQ_PRESETS, setEQPreset, type EQPresetName } from '@/core/audioFx'
import { useSettingValue } from '@/store/setting/hook'

// 【车机改造】均衡器预设选择
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const current = useSettingValue('player.eqPreset') as EQPresetName

  return (
    <SubTitle title={t('setting_player_eq')}>
      <View style={styles.row}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {(Object.keys(EQ_PRESETS) as EQPresetName[]).map(name => {
            const active = current == name
            return (
              <Button key={name} style={{ ...styles.btn, backgroundColor: active ? theme['c-primary'] : theme['c-button-background'] }} onPress={() => { void setEQPreset(name) }}>
                <Text size={14} color={active ? '#ffffff' : theme['c-button-font']}>
                  {t(`setting_player_eq_${name}`)}
                </Text>
              </Button>
            )
          })}
        </ScrollView>
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  row: {
    flexDirection: 'row',
    marginTop: 5,
    marginBottom: 5,
  },
  scroll: {
    flexDirection: 'row',
    paddingRight: 10,
  },
  btn: {
    borderRadius: 4,
    marginRight: 10,
    overflow: 'hidden',
  },
})
