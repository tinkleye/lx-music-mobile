import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Dialog, { type DialogType } from '@/components/common/Dialog'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { readDir, getExternalStoragePaths, type FileType } from '@/utils/fs'

interface DirEntry { name: string; path: string }

// 路径展示美化：内置存储前缀替换为可读名，U盘卷名保留
const displayPath = (p: string, storageLabel: string, usbLabel: string) => {
  if (p.startsWith('/storage/emulated/0/')) return p.replace('/storage/emulated/0/', `${storageLabel}/`)
  if (p == '/storage/emulated/0') return storageLabel
  const m = p.match(/^\/storage\/([A-Za-z0-9-]{4,})(\/|$)/)
  if (m) return p.replace(`/storage/${m[1]}/`, `${usbLabel}/`).replace(`/storage/${m[1]}`, usbLabel)
  return p
}

const parentOf = (p: string) => {
  const norm = p.replace(/\/+$/, '')
  const idx = norm.lastIndexOf('/')
  return idx > 0 ? norm.slice(0, idx) : '/'
}

export interface DirBrowserType {
  show: () => void
}

/**
 * 【v45】下载目录「任选路径」：逐级浏览目录，选中即保存，不做手输。
 * 根视图列出内置存储 + U盘卷作为起点，进入后列出子目录，顶部可返回上一级。
 */
export default forwardRef<DirBrowserType, { onSelect: (path: string) => void }>(({ onSelect }, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const dialogRef = useRef<DialogType>(null)
  const [currentPath, setCurrentPath] = useState('') // '' = 根视图
  const [dirs, setDirs] = useState<DirEntry[]>([])

  const enterDir = async(path: string) => {
    setCurrentPath(path)
    try {
      const list: FileType[] = await readDir(path)
      setDirs(list
        .filter(f => f.isDirectory)
        .map(f => ({ name: f.name, path: f.path }))
        .sort((a, b) => a.name.localeCompare(b.name)))
    } catch {
      setDirs([])
    }
  }

  const showRoots = async() => {
    setCurrentPath('')
    const roots: DirEntry[] = [{ name: t('local_music_storage'), path: '/storage/emulated/0' }]
    try {
      const extra = await getExternalStoragePaths(true)
      for (const r of extra ?? []) {
        const norm = r.replace(/\/+$/, '')
        if (norm && norm != '/storage/emulated/0' && !roots.some(x => x.path == norm)) {
          roots.push({ name: t('local_music_usb'), path: norm })
        }
      }
    } catch {
      // 忽略 U盘卷枚举失败
    }
    setDirs(roots)
  }

  useImperativeHandle(ref, () => ({
    show() {
      dialogRef.current?.setVisible(true)
      void showRoots()
    },
  }))

  const isRoot = currentPath == ''

  return (
    <Dialog ref={dialogRef} title={t('download_dir_browse_title')} width={440}>
      <View style={styles.body}>
        {
          !isRoot ? (
            <TouchableOpacity style={styles.pathRow} onPress={() => { void enterDir(parentOf(currentPath)) }}>
              <Icon name="chevron-left" size={14} color={theme['c-primary-font']} />
              <Text size={12} color={theme['c-primary-font']} numberOfLines={1} style={styles.pathText}>
                {displayPath(currentPath, t('local_music_storage'), t('local_music_usb'))}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        <ScrollView style={styles.list}>
          {
            dirs.length
              ? dirs.map(d => (
                <TouchableOpacity key={d.path} style={styles.row} onPress={() => { void enterDir(d.path) }}>
                  <Icon name={isRoot ? 'sd-card' : 'add_folder'} size={14} color={theme['c-font-label']} />
                  <Text size={13} color={theme['c-font']} numberOfLines={1} style={styles.rowText}>{d.name}</Text>
                </TouchableOpacity>
              ))
              : <Text size={12} color={theme['c-font-label']}>{t('download_dir_empty')}</Text>
          }
        </ScrollView>
        <TouchableOpacity
          style={{ ...styles.selectBtn, backgroundColor: isRoot ? theme['c-300'] : theme['c-primary'] }}
          disabled={isRoot}
          onPress={() => {
            dialogRef.current?.setVisible(false)
            onSelect(currentPath)
          }}
        >
          <Text size={14} color={isRoot ? theme['c-font-label'] : theme['c-primary-font']}>{t('download_dir_select')}</Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  )
})

const styles = createStyle({
  body: {
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  pathText: {
    flex: 1,
  },
  list: {
    flexGrow: 0,
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  rowText: {
    flex: 1,
  },
  selectBtn: {
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
