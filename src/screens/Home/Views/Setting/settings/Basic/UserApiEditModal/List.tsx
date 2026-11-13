import { useCallback, useEffect, useRef, useState } from 'react'
import { Clipboard, TextInput, View, TouchableOpacity, ScrollView } from 'react-native'
import Text from '@/components/common/Text'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useUserApiList, state as userApiState } from '@/store/userApi'
import { useSettingValue } from '@/store/setting/hook'
import { checkUserApiUpdate, removeUserApi, setUserApiAllowShowUpdateAlert, updateUserApi } from '@/core/userApi'
import { BorderRadius } from '@/theme'
import CheckBox from '@/components/common/CheckBox'
import { Icon } from '@/components/common/Icon'
import settingState from '@/store/setting/state'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'
import { getUserApiFallbacks, setUserApiFallbacks, getUserApiScript } from '@/utils/data'
import { isCarModeEnabled } from '@/config/carMode'

// 【改造】车机横屏下行高紧张，列表项排版更紧凑
const carMode = isCarModeEnabled()

const formatVersionName = (version: string) => {
  return /^\d/.test(version) ? `v${version}` : version
}
const ListItem = ({ item, activeId, checking, fallbackIndex, fallbackTotal, onRemove, onChangeAllowShowUpdateAlert, onCheckUpdate, onToggleFallback, onMoveFallback, onCopyUrl, onAddUrl, onShowDetail }: {
  item: LX.UserApi.UserApiInfo
  activeId: string
  checking: boolean
  fallbackIndex: number
  fallbackTotal: number
  onRemove: (id: string, name: string) => void
  onChangeAllowShowUpdateAlert: (id: string, enabled: boolean) => void
  onCheckUpdate: (id: string) => void
  onToggleFallback: (id: string, enabled: boolean) => void
  onMoveFallback: (id: string, offset: number) => void
  onCopyUrl: (item: LX.UserApi.UserApiInfo) => void
  onAddUrl: (item: LX.UserApi.UserApiInfo) => void
  onShowDetail: (item: LX.UserApi.UserApiInfo) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const changeAllowShowUpdateAlert = (check: boolean) => {
    onChangeAllowShowUpdateAlert(item.id, check)
  }
  const handleRemove = () => {
    onRemove(item.id, item.name)
  }
  const handleCheckUpdate = () => {
    onCheckUpdate(item.id)
  }
  const handleToggleFallback = (check: boolean) => {
    onToggleFallback(item.id, check)
  }
  const isActive = activeId == item.id
  const isFallback = fallbackIndex > -1

  return (
    <View style={{ ...styles.listItem, backgroundColor: isActive ? theme['c-primary-background-active'] : 'transparent' }}>
      <View style={styles.listItemLeft}>
        <Text size={14}>
          {item.name}
          {
            item.version ? (
              <Text size={12} color={theme['c-font-label']}>{ '   ' + formatVersionName(item.version) }</Text>
            ) : null
          }
          {
            item.author ? (
              <Text size={12} color={theme['c-font-label']}>{ '   ' + item.author }</Text>
            ) : null
          }
        </Text>
        {
          item.description ? (
            <Text size={12} color={theme['c-font-label']} numberOfLines={carMode ? 1 : undefined}>{item.description}</Text>
          ) : null
        }
        {
          // 【改造】显示记录下来的来源地址，方便确认自动更新是否生效
          // 【v42】点击来源地址 = 复制
          item.sourceUrl ? (
            <TouchableOpacity onPress={() => { onCopyUrl(item) }}>
              <Text size={11} color={theme['c-font-label']} numberOfLines={1}>
                {t('user_api_source_url', { url: item.sourceUrl })}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        {/* 【改造】备用源勾选、「主源」标记、「允许更新提示」合并在同一行，省出行高给源列表 */}
        <View style={styles.checkRow}>
          {
            isActive
              ? <Text size={11} color={theme['c-primary-font']}>{t('user_api_primary_source')}</Text>
              : <CheckBox check={isFallback} label={t('user_api_backup_source')} onChange={handleToggleFallback} size={0.86} />
          }
          {
            !isActive && isFallback
              ? (
                  <View style={styles.orderBtns}>
                    <Text size={11} color={theme['c-font-label']}>{t('user_api_backup_source_order', { index: fallbackIndex + 1 })}</Text>
                    <TouchableOpacity
                      style={styles.orderBtn}
                      disabled={fallbackIndex <= 0}
                      onPress={() => { onMoveFallback(item.id, -1) }}
                    >
                      <Text size={11} color={fallbackIndex <= 0 ? theme['c-350'] : theme['c-primary-font']}>{t('user_api_move_up')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.orderBtn}
                      disabled={fallbackIndex >= fallbackTotal - 1}
                      onPress={() => { onMoveFallback(item.id, 1) }}
                    >
                      <Text size={11} color={fallbackIndex >= fallbackTotal - 1 ? theme['c-350'] : theme['c-primary-font']}>{t('user_api_move_down')}</Text>
                    </TouchableOpacity>
                  </View>
                )
              : null
          }
          <CheckBox check={item.allowShowUpdateAlert} label={t('user_api_allow_show_update_alert')} onChange={changeAllowShowUpdateAlert} size={0.86} />
          {/* 【v45】查看详情（复制地址 / 补地址已收进详情页） */}
          <TouchableOpacity style={styles.orderBtn} onPress={() => { onShowDetail(item) }}>
            <Text size={11} color={theme['c-primary-font']}>{t('user_api_detail_btn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.listItemRight}>
        {
          // 【改造】记录了来源地址的源可以单独检查更新
          item.sourceUrl ? (
            <TouchableOpacity style={styles.btn} onPress={handleCheckUpdate} disabled={checking}>
              <Icon name="available_updates" color={checking ? theme['c-font-label'] : theme['c-button-font']} />
            </TouchableOpacity>
          ) : null
        }
        <TouchableOpacity style={styles.btn} onPress={handleRemove}>
          <Icon name="close" color={theme['c-button-font']} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export interface UserApiEditModalProps {
  onSave: (rules: string) => void
  // onSourceChange: SourceSelectorProps['onSourceChange']
}
export interface UserApiEditModalType {
  show: (rules: string) => void
}


export default () => {
  const userApiList = useUserApiList()
  const apiSource = useSettingValue('common.apiSource')
  const theme = useTheme()
  const t = useI18n()
  const [checkingId, setCheckingId] = useState('')
  // 【改造】备用源列表，顺序即尝试优先级
  const [fallbacks, setFallbacks] = useState<string[]>([])

  useEffect(() => {
    void getUserApiFallbacks().then(list => {
      setFallbacks(list)
    })
  }, [])

  const saveFallbacks = useCallback((list: string[]) => {
    setFallbacks(list)
    void setUserApiFallbacks(list)
  }, [])

  const handleToggleFallback = useCallback((id: string, enabled: boolean) => {
    const list = enabled
      ? [...fallbacks.filter(item => item != id), id]
      : fallbacks.filter(item => item != id)
    saveFallbacks(list)
  }, [fallbacks, saveFallbacks])

  const handleMoveFallback = useCallback((id: string, offset: number) => {
    const index = fallbacks.indexOf(id)
    const target = index + offset
    if (index < 0 || target < 0 || target >= fallbacks.length) return
    const list = [...fallbacks]
    list.splice(index, 1)
    list.splice(target, 0, id)
    saveFallbacks(list)
  }, [fallbacks, saveFallbacks])

  const handleRemove = useCallback(async(id: string, name: string) => {
    const confirm = await confirmDialog({
      message: global.i18n.t('user_api_remove_tip', { name }),
      cancelButtonText: global.i18n.t('cancel_button_text_2'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
      bgClose: false,
    })
    if (!confirm) return
    if (fallbacks.includes(id)) saveFallbacks(fallbacks.filter(item => item != id))
    void removeUserApi([id]).finally(() => {
      if (settingState.setting['common.apiSource'] == id) {
        let backApiId = apiSourceInfo.find(api => !api.disabled)?.id
        if (!backApiId) backApiId = userApiState.list[0]?.id
        setApiSource(backApiId ?? '')
      }
    })
  }, [fallbacks, saveFallbacks])
  const handleChangeAllowShowUpdateAlert = useCallback((id: string, enabled: boolean) => {
    void setUserApiAllowShowUpdateAlert(id, enabled)
  }, [])
  const handleCheckUpdate = useCallback(async(id: string) => {
    if (checkingId) return
    setCheckingId(id)
    const result = await checkUserApiUpdate(id)
    setCheckingId('')
    switch (result.status) {
      case 'updated':
        toast(t('user_api_update_success_tip', {
          name: result.info.name,
          version: result.info.version ? `v${result.info.version}` : '',
        }))
        break
      case 'none':
        toast(t('user_api_check_update_none'))
        break
      case 'no_url':
        toast(t('user_api_no_source_url'), 'long')
        break
      case 'failed':
        toast(t('user_api_check_update_failed', { message: result.message }), 'long')
        break
      default:
        break
    }
  }, [checkingId, t])

  // 【v42】复制源地址 / 补充来源地址 / 查看详情
  const [detailItem, setDetailItem] = useState<LX.UserApi.UserApiInfo | null>(null)
  const [addUrlItem, setAddUrlItem] = useState<LX.UserApi.UserApiInfo | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const addUrlDialogRef = useRef<DialogType>(null)
  const detailDialogRef = useRef<DialogType>(null)

  const handleCopyUrl = useCallback((item: LX.UserApi.UserApiInfo) => {
    if (!item.sourceUrl) return
    Clipboard.setString(item.sourceUrl)
    toast(t('user_api_url_copied'))
  }, [t])

  const handleShowDetail = useCallback((item: LX.UserApi.UserApiInfo) => {
    setDetailItem(item)
    requestAnimationFrame(() => { detailDialogRef.current?.setVisible(true) })
  }, [])

  const handleShowAddUrl = useCallback((item: LX.UserApi.UserApiInfo) => {
    setAddUrlItem(item)
    setUrlInput('')
    requestAnimationFrame(() => { addUrlDialogRef.current?.setVisible(true) })
  }, [])

  const handleSaveAddUrl = useCallback(async() => {
    if (!addUrlItem) return
    const url = urlInput.trim()
    if (!url) return
    try {
      const script = await getUserApiScript(addUrlItem.id)
      await updateUserApi(addUrlItem.id, script, url)
      toast(t('user_api_url_saved'))
    } catch (err) {
      toast(t('user_api_url_save_failed'), 'long')
    }
    addUrlDialogRef.current?.setVisible(false)
  }, [addUrlItem, urlInput, t])

  return (
    <>
    <ScrollView style={styles.scrollView} keyboardShouldPersistTaps={'always'}>
      <View onStartShouldSetResponder={() => true}>
        {
          userApiList.length
            ? userApiList.map((item) => {
              return (
              <ListItem
                key={item.id}
                item={item}
                activeId={apiSource}
                checking={checkingId == item.id}
                fallbackIndex={fallbacks.indexOf(item.id)}
                fallbackTotal={fallbacks.length}
                onRemove={handleRemove}
                onChangeAllowShowUpdateAlert={handleChangeAllowShowUpdateAlert}
                onCheckUpdate={handleCheckUpdate}
                onToggleFallback={handleToggleFallback}
                onMoveFallback={handleMoveFallback}
                onCopyUrl={handleCopyUrl}
                onAddUrl={handleShowAddUrl}
                onShowDetail={handleShowDetail}
              />
              )
            })
            : <Text style={styles.tipText} color={theme['c-font-label']}>{t('user_api_empty')}</Text>
        }
      </View>
      {
        fallbacks.length
          ? <Text style={styles.fallbackTip} size={11} color={theme['c-font-label']}>{t('user_api_backup_source_tip')}</Text>
          : null
      }
    </ScrollView>
    {/* 【v42】查看详情 */}
    <Dialog ref={detailDialogRef} title={t('user_api_detail_btn')} width={420}>
      {
        detailItem ? (
          <View style={styles.detailBox}>
            <Text size={14}>{detailItem.name}{detailItem.version ? `  v${detailItem.version}` : ''}</Text>
            {detailItem.author ? <Text size={12} color={theme['c-font-label']}>{`${t('user_api_detail_author')}: ${detailItem.author}`}</Text> : null}
            {detailItem.description ? <Text size={12} color={theme['c-font-label']}>{detailItem.description}</Text> : null}
            <Text size={12} color={theme['c-font-label']}>{`${t('user_api_detail_import_type')}: ${detailItem.sourceUrl ? t('user_api_detail_import_online') : t('user_api_detail_import_local')}`}</Text>
            {
              detailItem.sourceUrl ? (
                <TouchableOpacity onPress={() => { handleCopyUrl(detailItem) }}>
                  <Text size={12} color={theme['c-primary-font']}>{`${t('user_api_detail_source_url')}: ${detailItem.sourceUrl}`}</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text size={12} color={theme['c-font-label']}>{t('user_api_detail_none_url')}</Text>
                  {/* 【v45】补地址收进详情页：先关详情再打开补地址弹窗 */}
                  <TouchableOpacity
                    style={styles.detailAddUrl}
                    onPress={() => {
                      detailDialogRef.current?.setVisible(false)
                      handleShowAddUrl(detailItem)
                    }}
                  >
                    <Text size={12} color={theme['c-primary-font']}>{t('user_api_add_url_btn')}</Text>
                  </TouchableOpacity>
                </>
              )
            }
          </View>
        ) : null
      }
    </Dialog>
    {/* 【v42】补充来源地址 */}
    <Dialog ref={addUrlDialogRef} title={t('user_api_add_url_btn')} width={420}>
      <View style={styles.detailBox}>
        <Text size={12} color={theme['c-font-label']}>{t('user_api_add_url_tip')}</Text>
        <TextInput
          style={{ ...styles.urlInput, color: theme['c-font'], borderColor: theme['c-primary-light-100-alpha-200'] }}
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder="https://"
          placeholderTextColor={theme['c-300']}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.urlSaveBtn} onPress={() => { void handleSaveAddUrl() }}>
          <Text size={13} color={theme['c-primary-font']}>{t('confirm')}</Text>
        </TouchableOpacity>
      </View>
    </Dialog>
    </>
  )
}


const styles = createStyle({
  detailBox: {
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  detailAddUrl: {
    alignSelf: 'flex-start',
    paddingTop: 4,
    paddingBottom: 2,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 13,
  },
  urlSaveBtn: {
    alignSelf: 'flex-end',
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 14,
    paddingRight: 14,
  },
  scrollView: {
    paddingHorizontal: 7,
    flexGrow: 0,
    // 【改造】内容多时要能在弹窗内滚动，而不是把弹窗撑破
    flexShrink: 1,
  },
  list: {
    paddingBottom: 15,
    flexDirection: 'column',
  },
  listItem: {
    padding: carMode ? 8 : 10,
    borderRadius: BorderRadius.normal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemLeft: {
    paddingRight: 10,
    flex: 1,
    gap: carMode ? 1 : 2,
  },
  listItemRight: {
    flex: 0,
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  // btns: {
  //   padding: 5,
  // },
  btn: {
    padding: 10,
    // backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  tipText: {
    textAlign: 'center',
    marginTop: 25,
    marginBottom: 15,
  },
  // 【改造】备用源勾选与排序（与「允许更新提示」并排，会自动换行）
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  orderBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fallbackTip: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 12,
  },
})

