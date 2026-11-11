import { useState, useCallback, useEffect } from 'react'
import { View, TouchableOpacity } from 'react-native'

// 【车机改造】本地音乐视图：固定显示「本地音乐」列表（listId 锁定，与我的列表互不干扰）
// 【v33】新增：歌曲/专辑/歌手/文件夹 四种视图切换；扫描范围（指定文件夹，可多选）
// 【v34】顶部「本地音乐」标题移除，4 个视图选项合并到原标题行（与扫描范围、扫描按钮同行）；
//        扫描范围改为排除制：列出所有扫到疑似音乐的文件夹，默认全选，取消勾选即不显示
// 注意：createStyle 等工具函数必须显式导入（v31 崩溃教训）
import { useI18n } from '@/lang'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { LOCAL_LIST_ID, scanLocalMusic, type ScanResult } from '@/core/music/localLibrary'
import { getListMusics } from '@/utils/listManage'
import { getLocalScanExcluded, saveLocalScanExcluded } from '@/utils/data'
import { playList } from '@/core/player/player'
import MusicList from '../Mylist/MusicList'
import GroupView, { type GroupBy } from './GroupView'
import FolderPickerModal from './FolderPickerModal'

const VIEW_TABS: { id: 'songs' | GroupBy, labelKey: string }[] = [
  { id: 'songs', labelKey: 'local_music_view_songs' },
  { id: 'album', labelKey: 'local_music_view_album' },
  { id: 'singer', labelKey: 'local_music_view_singer' },
  { id: 'folder', labelKey: 'local_music_view_folder' },
]

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const [isScanning, setIsScanning] = useState(false)
  const [viewMode, setViewMode] = useState<'songs' | GroupBy>('songs')
  const [musics, setMusics] = useState<LX.Music.MusicInfo[]>([])
  const [scanExcluded, setScanExcluded] = useState<string[]>([])
  const [showFolderPicker, setShowFolderPicker] = useState(false)

  // 分组视图需要列表数据：初始化 + 列表更新事件时刷新
  useEffect(() => {
    const handleChange = (ids: string[]) => {
      if (!ids.includes(LOCAL_LIST_ID)) return
      void getListMusics(LOCAL_LIST_ID).then(setMusics)
    }
    void getListMusics(LOCAL_LIST_ID).then(setMusics)
    global.app_event.on('myListMusicUpdate', handleChange)
    return () => {
      global.app_event.off('myListMusicUpdate', handleChange)
    }
  }, [])

  // 已保存的排除文件夹
  useEffect(() => {
    void getLocalScanExcluded().then(setScanExcluded)
  }, [])

  const handleScan = useCallback(async() => {
    if (isScanning) return
    setIsScanning(true)
    try {
      const result: ScanResult = await scanLocalMusic()
      if (result.err == 'permission') {
        toast(t('local_music_permission'), 'long')
      } else if (result.added == 0 && result.removed == 0) {
        toast(t('local_music_scan_none'), 'short')
      } else {
        toast(t('local_music_scan_done', { added: result.added, removed: result.removed }), 'long')
      }
    } catch (err: any) {
      toast(t('local_music_scan_fail'), 'long')
    } finally {
      setIsScanning(false)
    }
  }, [isScanning, t])

  const handlePlay = useCallback((index: number) => {
    void playList(LOCAL_LIST_ID, index)
  }, [])

  const handleFoldersConfirm = useCallback((excluded: string[]) => {
    setShowFolderPicker(false)
    setScanExcluded(excluded)
    void saveLocalScanExcluded(excluded)
    toast(excluded.length
      ? t('local_music_folder_saved', { n: excluded.length })
      : t('local_music_folder_all'), 'short')
  }, [t])

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }}>
      <View style={{ ...styles.header, borderBottomColor: theme['c-border'] }}>
        {
          VIEW_TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabItem,
                viewMode == tab.id ? { ...styles.tabActive, borderBottomColor: theme['c-primary'] } : null,
              ]}
              onPress={() => { setViewMode(tab.id) }}
            >
              <Text numberOfLines={1} style={{ ...styles.tabText, color: viewMode == tab.id ? theme['c-primary'] : theme['c-font'] }}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          ))
        }
        <TouchableOpacity style={styles.actionBtn} onPress={() => { setShowFolderPicker(true) }}>
          <Icon name="add_folder" size={16} color={theme['c-primary']} />
          <Text numberOfLines={1} style={{ ...styles.actionText, color: theme['c-primary'] }}>
            {scanExcluded.length
              ? t('local_music_folder_n', { n: scanExcluded.length })
              : t('local_music_pick_folder')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleScan} disabled={isScanning}>
          <Icon name="search-2" size={16} color={isScanning ? theme['c-350'] : theme['c-primary']} />
          <Text numberOfLines={1} style={{ ...styles.actionText, color: isScanning ? theme['c-350'] : theme['c-primary'] }}>
            {isScanning ? t('local_music_scanning') : t('local_music_scan')}
          </Text>
        </TouchableOpacity>
      </View>
      {
        viewMode == 'songs'
          ? <MusicList listId={LOCAL_LIST_ID} />
          : <GroupView musics={musics} groupBy={viewMode} onPlay={handlePlay} />
      }
      <FolderPickerModal
        visible={showFolderPicker}
        excluded={scanExcluded}
        onClose={handleFoldersConfirm} />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 12,
    borderBottomWidth: BorderWidths.normal,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {},
  tabText: {
    fontSize: 13,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 10,
    paddingTop: 12,
    paddingBottom: 10,
  },
  actionText: {
    fontSize: 13,
  },
})
