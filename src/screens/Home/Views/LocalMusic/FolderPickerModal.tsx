import { memo, useEffect, useState } from 'react'
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native'

// 【v33】扫描文件夹选择器（多选）
// 【v34】重做：不再逐层导航（二级目录无法继续下钻），改为调用原生 getAudioFolders
// 直接列出所有「扫到疑似音乐」的文件夹（与扫描同源过滤，显示路径 + 歌曲数）。
// 默认全部勾选，用户取消勾选的文件夹不参与扫描（排除黑名单语义）。
// 确认按钮文字色按主色亮度自适应黑/白，修复深色主题下文字与背景分不开的问题。
// 注意：createStyle 等工具函数必须显式导入（v31 崩溃教训）
import CheckBox from '@/components/common/CheckBox'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { NativeModules } from 'react-native'

interface AudioFolder {
  path: string
  count: number
}

const parseRgb = (c: string): [number, number, number] | null => {
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const parts = m[1].split(',').map(s => parseFloat(s.trim()))
  if (Number.isNaN(parts[0])) return null
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

// 按感知亮度选择按钮文字颜色：亮背景配黑字、暗背景配白字
const getContrastFont = (primary: string) => {
  const rgb = parseRgb(primary)
  if (!rgb) return '#ffffff'
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
  return lum > 150 ? '#000000' : '#ffffff'
}

// 路径展示美化：内置存储前缀替换为可读名，U盘卷名（/storage/XXXX-XXXX）保留
const displayPath = (p: string, storageLabel: string, usbLabel: string) => {
  if (p.startsWith('/storage/emulated/0/')) return p.replace('/storage/emulated/0/', `${storageLabel}/`)
  if (p == '/storage/emulated/0') return storageLabel
  const m = p.match(/^\/storage\/([A-Za-z0-9-]{4,})(\/|$)/)
  if (m) return p.replace(`/storage/${m[1]}/`, `${usbLabel}/`).replace(`/storage/${m[1]}`, usbLabel)
  return p
}

export default memo(({ visible, excluded, onClose }: {
  visible: boolean
  excluded: string[]
  onClose: (excluded: string[]) => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const [folders, setFolders] = useState<AudioFolder[] | null>(null)
  const [excludedSet, setExcludedSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  // 每次打开：拉取含音乐的文件夹列表 + 同步外部排除状态
  useEffect(() => {
    if (!visible) return
    setExcludedSet(new Set(excluded))
    setLoading(true)
    void (async() => {
      try {
        const list: AudioFolder[] = await NativeModules.MediaScannerModule.getAudioFolders()
        setFolders(list)
      } catch {
        setFolders(null)
      }
      setLoading(false)
    })()
  }, [visible, excluded])

  const isChecked = (path: string) => !excludedSet.has(path)

  const toggleFolder = (path: string) => {
    setExcludedSet(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleClose = () => {
    // 合并历史排除项（文件夹暂时无文件/U盘未挂载时保留记录，插回后仍生效）
    const merged = new Set(excludedSet)
    for (const f of excluded) merged.add(f)
    onClose([...merged])
  }

  const resetAll = () => {
    setExcludedSet(new Set())
  }

  const confirmFont = getContrastFont(theme['c-primary'])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.mask}>
        <View style={{ ...styles.dialog, backgroundColor: theme['c-main-background'] }}>
          <View style={styles.titleRow}>
            <Text style={{ ...styles.title, color: theme['c-font'] }}>{t('local_music_pick_folder')}</Text>
            <Text style={{ ...styles.count, color: theme['c-font-label'] }}>
              {t('local_music_folder_selected', { n: folders?.length ? folders.length - excludedSet.size : 0 })}
            </Text>
          </View>
          <Text style={{ ...styles.tip, color: theme['c-font-label'] }}>{t('local_music_folder_tip')}</Text>

          <ScrollView style={styles.list}>
            {
              loading
                ? <Text style={{ ...styles.tip, color: theme['c-font-label'] }}>...</Text>
                : (folders == null || folders.length == 0
                    ? <Text style={{ ...styles.tip, color: theme['c-font-label'] }}>{t('local_music_folder_none')}</Text>
                    : folders.map(f => (
                      <View key={f.path} style={{ ...styles.row, borderBottomColor: theme['c-border'] }}>
                        <View style={styles.nameWrap}>
                          <Text numberOfLines={2} style={{ ...styles.name, color: theme['c-font'] }}>{displayPath(f.path, t('local_music_storage'), t('local_music_usb'))}</Text>
                          <Text style={{ ...styles.count, color: theme['c-font-label'] }}>{t('local_music_folder_songs', { n: f.count })}</Text>
                        </View>
                        <CheckBox
                          check={isChecked(f.path)}
                          onChange={() => { toggleFolder(f.path) }}
                          need />
                      </View>
                    )))
            }
          </ScrollView>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btn} onPress={resetAll}>
              <Text style={{ color: theme['c-font-label'] }}>{t('local_music_folder_reset')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ ...styles.btn, backgroundColor: theme['c-primary'] }}
              onPress={handleClose}>
              <Text style={{ color: confirmFont }}>{t('confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
})

const styles = createStyle({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  dialog: {
    borderRadius: 10,
    maxHeight: '80%',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  count: {
    fontSize: 12,
  },
  tip: {
    fontSize: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: BorderWidths.normal,
    gap: 10,
  },
  nameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  btn: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 6,
    borderWidth: BorderWidths.normal,
    borderColor: 'transparent',
  },
})
