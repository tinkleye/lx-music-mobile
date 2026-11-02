import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import Text from '@/components/common/Text'
import { View, TouchableOpacity } from 'react-native'
import { createStyle, openUrl, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import Button from '@/components/common/Button'
import List from './List'
import ImportBtn from './ImportBtn'
import CheckBoxItem from '../../../components/CheckBoxItem'
import { checkUserApiUpdates } from '@/core/userApi'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { isCarModeEnabled } from '@/config/carMode'

// 【改造】车机横屏下行高比较紧张，排版需要更紧凑
const carMode = isCarModeEnabled()

// interface UrlInputType {
//   setText: (text: string) => void
//   getText: () => string
//   focus: () => void
// }
// const UrlInput = forwardRef<UrlInputType, {}>((props, ref) => {
//   const theme = useTheme()
//   const t = useI18n()
//   const [text, setText] = useState('')
//   const inputRef = useRef<InputType>(null)
//   const [height, setHeight] = useState(100)

//   useImperativeHandle(ref, () => ({
//     getText() {
//       return text.trim()
//     },
//     setText(text) {
//       setText(text)
//     },
//     focus() {
//       inputRef.current?.focus()
//     },
//   }))

//   const handleLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
//     setHeight(nativeEvent.layout.height)
//   }, [])

//   return (
//     <View style={styles.inputContent} onLayout={handleLayout}>
//       <Input
//         ref={inputRef}
//         value={text}
//         onChangeText={setText}
//         textAlignVertical="top"
//         placeholder={t('setting_dislike_list_input_tip')}
//         size={12}
//         style={{ ...styles.input, height, backgroundColor: theme['c-primary-input-background'] }}
//       />
//     </View>
//   )
// })


// export interface UserApiEditModalProps {
//   onSave: (rules: string) => void
//   // onSourceChange: SourceSelectorProps['onSourceChange']
// }
export interface UserApiEditModalType {
  show: () => void
}

export default forwardRef<UserApiEditModalType, {}>((props, ref) => {
  const dialogRef = useRef<DialogType>(null)
  // const sourceSelectorRef = useRef<SourceSelectorType>(null)
  // const inputRef = useRef<UrlInputType>(null)
  const [visible, setVisible] = useState(false)
  const [checkingAll, setCheckingAll] = useState(false)
  const theme = useTheme()
  const t = useI18n()
  // 【改造】启动时自动检查源更新（默认开启）
  const autoUpdate = useSettingValue('common.autoUpdateUserApi')

  const handleChangeAutoUpdate = (enable: boolean) => {
    updateSetting({ 'common.autoUpdateUserApi': enable })
  }

  // 【改造】手动检查全部源更新
  const handleCheckAll = async() => {
    if (checkingAll) return
    setCheckingAll(true)
    const result = await checkUserApiUpdates()
    setCheckingAll(false)
    if (!result.checked) {
      toast(t('user_api_no_source_url'), 'long')
      return
    }
    if (result.updated) toast(t('user_api_check_update_success', { count: result.updated }))
    else if (result.failed && !result.updated) toast(t('user_api_check_update_failed', { message: `${result.failed}` }), 'long')
    else toast(t('user_api_check_update_none'))
  }

  const handleShow = () => {
    dialogRef.current?.setVisible(true)
    // requestAnimationFrame(() => {
    // inputRef.current?.setText('')
    // sourceSelectorRef.current?.setSource(source)
    // setTimeout(() => {
    //   inputRef.current?.focus()
    // }, 300)
    // })
  }
  useImperativeHandle(ref, () => ({
    show() {
      if (visible) handleShow()
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShow()
        })
      }
    },
  }))

  const handleCancel = () => {
    dialogRef.current?.setVisible(false)
  }

  const openFAQPage = () => {
    void openUrl('https://lyswhut.github.io/lx-music-doc/mobile/custom-source')
  }

  return (
    visible
      ? (
          <Dialog ref={dialogRef} bgHide={false} fullHeight={carMode}>
            <View style={styles.content}>
              {/* <UrlInput ref={inputRef} /> */}
              {/* 【改造】标题和两个选项合并到同一行，车机横屏下省出一整行高度给源列表 */}
              <View style={styles.headerRow}>
                <Text size={carMode ? 15 : 16} style={styles.title} numberOfLines={1}>{t('user_api_title')}</Text>
                <View style={styles.headerActions}>
                  <CheckBoxItem
                    check={autoUpdate}
                    label={t('user_api_auto_update')}
                    onChange={handleChangeAutoUpdate}
                    size={0.86}
                  />
                  <TouchableOpacity onPress={handleCheckAll} disabled={checkingAll} style={styles.checkAllBtn}>
                    <Text size={12} color={theme['c-primary-font']}>
                      {checkingAll ? t('user_api_checking') : t('user_api_check_update_all')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <List />
              <View style={styles.tips}>
                <Text style={styles.tipsText} size={12}>
                  {t('user_api_readme')}
                </Text>
                <TouchableOpacity onPress={openFAQPage}>
                  <Text style={{ ...styles.tipsText, textDecorationLine: 'underline' }} size={12} color={theme['c-primary-font']}>FAQ</Text>
                </TouchableOpacity>
                {
                  // 【改造】车机横屏下行高紧张，这条风险提示省掉（内容偏长，占 2~3 行）
                  carMode
                    ? null
                    : (
                        <View>
                          <Text style={styles.tipsText} size={12}>{t('user_api_note')}</Text>
                        </View>
                      )
                }
              </View>
            </View>
            <View style={styles.btns}>
              <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleCancel}>
                <Text size={14} color={theme['c-button-font']}>{t('close')}</Text>
              </Button>
              <ImportBtn btnStyle={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} />
            </View>
          </Dialog>
        ) : null
  )
})


const styles = createStyle({
  content: {
    // flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: 8,
    paddingTop: carMode ? 10 : 15,
    paddingBottom: 10,
    flexDirection: 'column',
  },
  // 【改造】标题行：左边标题，右边两个开关/按钮，合并成一行
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 7,
    marginBottom: carMode ? 8 : 12,
    gap: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
  },
  title: {
    flexGrow: 0,
    flexShrink: 1,
  },
  checkAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tips: {
    paddingHorizontal: 7,
    marginTop: 15,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tipsText: {
    marginTop: 8,
    textAlignVertical: 'bottom',
    // lineHeight: 18,
    // backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 15,
    paddingLeft: 15,
    // paddingRight: 15,
  },
  btn: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 15,
  },
})


