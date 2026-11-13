import { memo, useEffect, useRef, useState } from 'react'
import { TextInput, TouchableOpacity, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'
import { toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { useTheme } from '@/store/theme/hook'
import {
  getBlockRules,
  saveBlockRules,
  subscribeBlockRules,
  buildBlockRulesText,
  parseBlockRulesText,
  type BlockRules,
} from '@/core/blockList'
import { createStyle } from '@/utils/tools'

/**
 * 【v42】不喜欢的歌曲（屏蔽规则）：屏蔽的歌手 / 屏蔽的歌名关键词。
 * 编辑器为每类规则一个输入框，逗号/换行分隔，支持批量粘贴维护。
 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const dialogRef = useRef<DialogType>(null)
  const [rules, setRules] = useState<BlockRules>(getBlockRules())
  const [singerInput, setSingerInput] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [batchInput, setBatchInput] = useState('')
  const [showBatch, setShowBatch] = useState(false)

  const total = rules.singers.length + rules.keywords.length

  const handleShow = () => {
    const current = getBlockRules()
    setRules(current)
    setSingerInput(current.singers.join('、'))
    setKeywordInput(current.keywords.join('、'))
    setBatchInput(buildBlockRulesText(current))
    setShowBatch(false)
    dialogRef.current?.setVisible(true)
  }

  const parseTags = (input: string) => {
    return input.split(/[、,，;；\n]/).map(s => s.trim()).filter(Boolean)
  }

  const handleSave = async() => {
    if (showBatch) {
      const parsed = parseBlockRulesText(batchInput)
      await saveBlockRules(parsed)
    } else {
      await saveBlockRules({
        singers: parseTags(singerInput),
        keywords: parseTags(keywordInput),
      })
    }
    toast(t('block_list_saved_tip'))
    dialogRef.current?.setVisible(false)
  }

  // 订阅外部变更（播放页屏蔽按钮）同步显示数量
  useEffect(() => subscribeBlockRules(() => { setRules({ ...getBlockRules() }) }), [])

  return (
    <SubTitle title={t('block_list_title')}>
      <View style={styles.row}>
        <Text>{t('block_list_label', { num: total })}</Text>
        <Button onPress={handleShow}>{t('block_list_edit_btn')}</Button>
      </View>

      <Dialog ref={dialogRef} title={t('block_list_title')} width={420}>
        {
          showBatch ? (
            <>
              <Text style={styles.tip} size={12} color={theme['c-font-label']}>{t('block_list_batch_tip')}</Text>
              <TextInput
                style={{ ...styles.input, ...styles.inputMultiline, color: theme['c-font'], borderColor: theme['c-primary-light-100-alpha-200'] }}
                multiline
                value={batchInput}
                onChangeText={setBatchInput}
                placeholder={t('block_list_batch_placeholder')}
                placeholderTextColor={theme['c-300']}
              />
            </>
          ) : (
            <>
              <Text style={styles.tip} size={12} color={theme['c-font-label']}>{t('block_list_singer_tip')}</Text>
              <TextInput
                style={{ ...styles.input, color: theme['c-font'], borderColor: theme['c-primary-light-100-alpha-200'] }}
                value={singerInput}
                onChangeText={setSingerInput}
                placeholder={t('block_list_singer_placeholder')}
                placeholderTextColor={theme['c-300']}
              />
              <Text style={styles.tip} size={12} color={theme['c-font-label']}>{t('block_list_keyword_tip')}</Text>
              <TextInput
                style={{ ...styles.input, color: theme['c-font'], borderColor: theme['c-primary-light-100-alpha-200'] }}
                value={keywordInput}
                onChangeText={setKeywordInput}
                placeholder={t('block_list_keyword_placeholder')}
                placeholderTextColor={theme['c-300']}
              />
              <TouchableOpacity onPress={() => { setShowBatch(true) }}>
                <Text style={styles.batchLink} size={12} color={theme['c-primary-font']}>{t('block_list_batch_btn')}</Text>
              </TouchableOpacity>
            </>
          )
        }
        <View style={styles.btnRow}>
          <Button style={styles.btnHalf} onPress={() => { dialogRef.current?.setVisible(false) }}>{t('cancel')}</Button>
          <Button style={styles.btnHalf} onPress={() => { void handleSave() }}>{t('confirm')}</Button>
        </View>
      </Dialog>
    </SubTitle>
  )
})

const styles = createStyle({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tip: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 14,
  },
  inputMultiline: {
    height: 180,
    textAlignVertical: 'top',
  },
  batchLink: {
    paddingTop: 8,
    paddingBottom: 2,
    alignSelf: 'flex-end',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 4,
  },
  btnHalf: {
    width: '48%',
  },
})
