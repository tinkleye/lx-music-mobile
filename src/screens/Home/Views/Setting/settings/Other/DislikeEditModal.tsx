import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import Text from '@/components/common/Text'
import { ScrollView, View } from 'react-native'
import Input, { type InputType } from '@/components/common/Input'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import Button from '@/components/common/Button'
import { useHorizontalMode } from '@/utils/hooks'

interface RuleInputType {
  setText: (text: string) => void
  getText: () => string
  focus: () => void
}
const RuleInput = forwardRef<RuleInputType, { height: number }>(({ height }, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const [text, setText] = useState('')
  const inputRef = useRef<InputType>(null)

  useImperativeHandle(ref, () => ({
    getText() {
      return text.trim()
    },
    setText(text) {
      setText(text)
    },
    focus() {
      inputRef.current?.focus()
    },
  }))

  return (
    <Input
      ref={inputRef}
      value={text}
      onChangeText={setText}
      multiline
      textAlignVertical="top"
      placeholder={t('setting_dislike_list_input_tip')}
      size={13}
      style={{ ...styles.input, height, backgroundColor: theme['c-primary-input-background'] }}
    />
  )
})


export interface DislikeEditModalProps {
  onSave: (rules: string) => void
}
export interface DislikeEditModalType {
  show: (rules: string) => void
}

export default forwardRef<DislikeEditModalType, DislikeEditModalProps>(({ onSave }, ref) => {
  const dialogRef = useRef<DialogType>(null)
  const inputRef = useRef<RuleInputType>(null)
  const [visible, setVisible] = useState(false)
  const theme = useTheme()
  const t = useI18n()
  // 【v56】横屏（车机）屏高低，55% 绝对高度太小导致输入框过矮，横屏适当加高
  const isHorizontalMode = useHorizontalMode()

  const handleShow = (rules: string) => {
    dialogRef.current?.setVisible(true)
    requestAnimationFrame(() => {
      inputRef.current?.setText(rules.length ? rules + '\n' : rules)
    })
  }
  useImperativeHandle(ref, () => ({
    show(rules) {
      if (visible) handleShow(rules)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShow(rules)
        })
      }
    },
  }))

  const handleCancel = () => {
    dialogRef.current?.setVisible(false)
  }
  const handleConfirm = () => {
    let rules = inputRef.current?.getText() ?? ''
    handleCancel()
    onSave(rules)
  }

  return (
    visible
      ? (
          <Dialog height={isHorizontalMode ? '72%' : '55%'} ref={dialogRef} bgHide={false}>
            {/* 【v58】整改：内容区包 ScrollView + 输入框固定高度 + 按钮固定在底部，
                彻底避免输入框与「取消/确认」按钮重叠；输入框内多行内容可滚动 */}
            <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.content}>
                <Text style={styles.inputTipText} size={13} color={theme['c-600']}>{t('setting_dislike_list_tips')}</Text>
                <RuleInput ref={inputRef} height={isHorizontalMode ? 200 : 160} />
              </View>
            </ScrollView>
            <View style={styles.btns}>
              <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleCancel}>
                <Text size={14} color={theme['c-button-font']}>{t('cancel')}</Text>
              </Button>
              <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleConfirm}>
                <Text size={14} color={theme['c-button-font']}>{t('confirm')}</Text>
              </Button>
            </View>
          </Dialog>
        ) : null
  )
})


const styles = createStyle({
  scrollContent: {
    flexGrow: 1,
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
    flexDirection: 'column',
  },
  input: {
    minWidth: 290,
    paddingTop: 5,
    paddingBottom: 5,
  },
  inputTipText: {
    marginBottom: 8,
  },

  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 15,
    paddingLeft: 15,
    flexGrow: 0,
    flexShrink: 0,
  },
  btn: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 15,
  },
})
