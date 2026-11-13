import { useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Section from '../../components/Section'
import CheckBoxItem from '../../components/CheckBoxItem'
import SubTitle from '../../components/SubTitle'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'

const CONCURRENCY_OPTIONS = [1, 2, 3, 4, 5, 6]

/**
 * 【v42】下载设置：询问音质 / 并发数 / 自动换源降级。
 */
export default () => {
  const t = useI18n()
  const theme = useTheme()
  const concurrency = useSettingValue('download.concurrency')
  const isAskQuality = useSettingValue('download.isAskQuality')
  const isAutoToggle = useSettingValue('download.isAutoToggleSource')
  const dialogRef = useRef<DialogType>(null)
  const [picked, setPicked] = useState(concurrency)

  return (
    <Section title={t('setting_download')}>
      <View style={styles.content}>
        <CheckBoxItem
          check={isAskQuality}
          label={t('download_setting_ask_quality')}
          helpDesc={t('download_setting_ask_quality_desc')}
          onChange={val => { updateSetting({ 'download.isAskQuality': val }) }} />
        <CheckBoxItem
          check={isAutoToggle}
          label={t('download_setting_auto_toggle')}
          helpDesc={t('download_setting_auto_toggle_desc')}
          onChange={val => { updateSetting({ 'download.isAutoToggleSource': val }) }} />
        <SubTitle title={t('download_setting_concurrency')}>
          <TouchableOpacity onPress={() => { setPicked(concurrency); dialogRef.current?.setVisible(true) }}>
            <Text size={14} color={theme['c-primary-font']}>{t('download_setting_concurrency_value', { count: concurrency })}</Text>
          </TouchableOpacity>
        </SubTitle>
      </View>

      <Dialog ref={dialogRef} title={t('download_setting_concurrency')} width={320}>
        <View style={styles.optionBox}>
          {CONCURRENCY_OPTIONS.map(num => (
            <TouchableOpacity
              key={num}
              style={{ ...styles.optionBtn, backgroundColor: picked == num ? theme['c-primary-background-active'] : theme['c-button-background'] }}
              onPress={() => { setPicked(num) }}
            >
              <Text style={{ color: picked == num ? theme['c-primary-font'] : theme['c-button-font'] }}>
                {`${num}${picked == num ? ` · ${t('download_quality_current')}` : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={{ ...styles.optionBtn, backgroundColor: theme['c-primary'] }}
            onPress={() => {
              updateSetting({ 'download.concurrency': picked })
              dialogRef.current?.setVisible(false)
            }}
          >
            <Text style={{ color: theme['c-primary-font'] }}>{t('confirm')}</Text>
          </TouchableOpacity>
        </View>
      </Dialog>
    </Section>
  )
}

const styles = createStyle({
  content: {
    marginTop: 5,
  },
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
