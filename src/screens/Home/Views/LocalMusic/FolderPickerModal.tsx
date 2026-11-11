import { memo, useEffect, useState } from 'react'
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native'

// 【v33】扫描文件夹选择器（多选）：
// 枚举存储卷 → 逐层进入子文件夹 → 勾选需要的文件夹（路径前缀匹配）。
// 不选任何文件夹 = 全盘扫描（默认行为不变）。
// 注意：createStyle 等工具函数必须显式导入（v31 崩溃教训）
import CheckBox from '@/components/common/CheckBox'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { readDir, stat, getExternalStoragePaths, externalStorageDirectoryPath } from '@/utils/fs'
import { BorderWidths } from '@/theme'

interface DirEntry {
  name: string
  path: string
}

const isHidden = (name: string) => name.startsWith('.')

const normalizeDir = (p: string) => (p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p)

export default memo(({ visible, folders, onClose }: {
  visible: boolean
  folders: string[]
  onClose: (folders: string[]) => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const [roots, setRoots] = useState<DirEntry[]>([])
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [dirs, setDirs] = useState<DirEntry[]>([])
  const [selected, setSelected] = useState<string[]>(folders)
  const [loading, setLoading] = useState(false)

  // 每次打开时同步外部已保存的选择
  useEffect(() => {
    if (visible) setSelected(folders)
  }, [visible, folders])

  // 初始化存储卷列表（内置存储 + U盘）
  useEffect(() => {
    if (!visible || roots.length) return
    void (async() => {
      let list: string[] = []
      try {
        list = await getExternalStoragePaths()
      } catch {}
      if (!list?.length) list = [externalStorageDirectoryPath]
      setRoots(list.map(p => ({ name: p, path: normalizeDir(p) })))
    })()
  }, [visible, roots.length])

  // 枚举当前目录下的子文件夹
  useEffect(() => {
    if (!visible || currentPath == null) return
    setLoading(true)
    void (async() => {
      const entries: DirEntry[] = []
      try {
        const names = await readDir(currentPath)
        for (const name of names) {
          if (isHidden(name)) continue
          const path = `${normalizeDir(currentPath)}/${name}`
          try {
            const st = await stat(path)
            if (st.isDirectory()) entries.push({ name, path })
          } catch { /* 无权限的目录直接跳过 */ }
        }
      } catch { /* 目录读取失败则显示为空 */ }
      entries.sort((a, b) => a.name.localeCompare(b.name))
      setDirs(entries)
      setLoading(false)
    })()
  }, [visible, currentPath])

  // 某个路径是否已被选中（或被上级选择覆盖）
  const isCovered = (path: string) => {
    return selected.some(f => {
      const fp = normalizeDir(f)
      return path == fp || path.startsWith(`${fp}/`)
    })
  }

  const toggleFolder = (path: string) => {
    const fp = normalizeDir(path)
    setSelected(prev => {
      if (prev.includes(fp)) return prev.filter(f => f != fp)
      // 已被上级覆盖时，勾选无实际意义，忽略
      if (prev.some(f => fp.startsWith(`${normalizeDir(f)}/`))) return prev
      return [...prev, fp]
    })
  }

  const parentPath = currentPath == null ? null : normalizeDir(currentPath).substring(0, normalizeDir(currentPath).lastIndexOf('/')) || null

  const labelOfRoot = (p: string) => {
    if (p == '/storage/emulated/0' || p == externalStorageDirectoryPath) return t('local_music_storage')
    const seg = normalizeDir(p).substring(normalizeDir(p).lastIndexOf('/') + 1)
    return seg
  }

  const labelOfCurrent = currentPath == null ? '' : normalizeDir(currentPath).substring(normalizeDir(currentPath).lastIndexOf('/') + 1)

  const handleClose = () => {
    onClose(selected)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.mask}>
        <View style={{ ...styles.dialog, backgroundColor: theme['c-main-background'] }}>
          <View style={styles.titleRow}>
            <Text style={{ ...styles.title, color: theme['c-font'] }}>{t('local_music_pick_folder')}</Text>
            <Text style={{ ...styles.count, color: theme['c-font-label'] }}>
              {t('local_music_folder_selected', { n: selected.length })}
            </Text>
          </View>

          <ScrollView style={styles.list}>
            {
              currentPath == null
                ? roots.map(r => (
                    <TouchableOpacity key={r.path} style={styles.row} onPress={() => { setCurrentPath(r.path) }}>
                      <Icon name="add_folder" size={18} color={theme['c-font-label']} />
                      <Text style={{ ...styles.name, color: theme['c-font'] }}>{labelOfRoot(r.path)}</Text>
                      <Icon name="play-outline" size={14} color={theme['c-font-label']} />
                    </TouchableOpacity>
                  ))
                : (
                    <>
                      <TouchableOpacity style={styles.row} onPress={() => { setCurrentPath(parentPath) }}>
                        <Icon name="single" size={16} color={theme['c-font-label']} />
                        <Text style={{ ...styles.name, color: theme['c-font-label'] }}>../</Text>
                      </TouchableOpacity>
                      <View style={styles.row}>
                        <Icon name="add_folder" size={18} color={theme['c-primary']} />
                        <Text style={{ ...styles.name, color: theme['c-font'] }}>{labelOfCurrent}</Text>
                        <CheckBox
                          check={isCovered(currentPath)}
                          onChange={() => { toggleFolder(currentPath) }}
                          need />
                      </View>
                      {
                        dirs.map(d => (
                          <View key={d.path} style={styles.row}>
                            <TouchableOpacity style={styles.nameBtn} onPress={() => { setCurrentPath(d.path) }}>
                              <Icon name="add_folder" size={18} color={theme['c-font-label']} />
                              <Text style={{ ...styles.name, color: theme['c-font'] }}>{d.name}</Text>
                            </TouchableOpacity>
                            <CheckBox
                              check={isCovered(d.path)}
                              onChange={() => { toggleFolder(d.path) }}
                              need />
                          </View>
                        ))
                      }
                      {loading ? <Text style={{ ...styles.tip, color: theme['c-font-label'] }}>...</Text> : null}
                    </>
                  )
            }
          </ScrollView>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btn} onPress={() => { setSelected([]) }}>
              <Text style={{ color: theme['c-font-label'] }}>{t('local_music_folder_clear')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ ...styles.btn, backgroundColor: theme['c-primary'] }} onPress={handleClose}>
              <Text style={{ color: theme['c-primary-font-active'] }}>{t('confirm')}</Text>
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
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  count: {
    fontSize: 12,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  nameBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: {
    fontSize: 14,
    flex: 1,
  },
  tip: {
    fontSize: 12,
    paddingTop: 6,
    textAlign: 'center',
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
