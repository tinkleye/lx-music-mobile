import { useState, useCallback, useEffect } from 'react'
import { View, TouchableOpacity, useWindowDimensions } from 'react-native'

// 【车机改造】本地音乐视图：固定显示「本地音乐」列表（listId 锁定，与我的列表互不干扰）
// 【v33】新增：歌曲/专辑/歌手/文件夹 四种视图切换；扫描范围（指定文件夹，可多选）
// 【v34】顶部「本地音乐」标题移除，4 个视图选项合并到原标题行（与扫描范围、扫描按钮同行）；
//        扫描范围改为排除制：列出所有扫到疑似音乐的文件夹，默认全选，取消勾选即不显示
// 【v37】横竖屏双布局：
//        竖屏 = 保持现有布局（顶部一行 tabs + 操作按钮），歌曲列表上下滚动；
//        横屏 = 三栏（全局导航栏 | 左侧控制栏 | 列表区），四个视图入口 + 扫描范围 + 扫描
//        全部移到左侧控制栏纵向排列，歌曲/专辑/歌手/文件夹列表全部左右翻页、不上下滚动。
// 注意：createStyle 等工具函数必须显式导入（v31 崩溃教训）
import { useI18n } from '@/lang'
import { Icon } from '@/components/common/Icon'
import IconIon from '@/components/common/IconIon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast, getRowInfo } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { LOCAL_LIST_ID, scanLocalMusic, type ScanResult } from '@/core/music/localLibrary'
import { getListMusics } from '@/utils/listManage'
import { getLocalScanExcluded, saveLocalScanExcluded } from '@/utils/data'
import { playList } from '@/core/player/player'
import MusicList from '../Mylist/MusicList'
import GroupView, { type GroupBy } from './GroupView'
import FolderPickerModal from './FolderPickerModal'

// 【v38】横屏控制栏上下分组：视图入口组贴顶、扫描操作组贴底，中间弹性留白；
// 视图入口配图标（歌曲=musical-notes 音符[Ionicons]、专辑=album 唱片、
// 歌手=leaderboard、文件夹=sd-card）；竖屏 tab 行同步图标。
// 分组头/歌曲行的视觉统一在 GroupView 内实现。
// 图标名用字面量类型（Icon 组件 name 是字面量联合，string 会在 tsc 报错）
type TabIcon =
  | { set: 'app', name: 'album' | 'leaderboard' | 'sd-card' }
  | { set: 'ion', name: 'musical-notes' }
const VIEW_TABS: { id: 'songs' | GroupBy, labelKey: string, icon: TabIcon | null }[] = [
  { id: 'songs', labelKey: 'local_music_view_songs', icon: { set: 'ion', name: 'musical-notes' } },
  { id: 'album', labelKey: 'local_music_view_album', icon: { set: 'app', name: 'album' } },
  { id: 'singer', labelKey: 'local_music_view_singer', icon: { set: 'app', name: 'leaderboard' } },
  { id: 'folder', labelKey: 'local_music_view_folder', icon: { set: 'app', name: 'sd-card' } },
]

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const { width: winW, height: winH } = useWindowDimensions()
  const isLandscape = winW > winH
  // 【v37】横屏列表列数：与歌单等页面一致，宽屏两列、窄屏单列
  const listColumns = isLandscape ? (getRowInfo().rowNum ?? 1) : 1
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

  // 列表内容（视图切换共用）
  const renderContent = () => {
    if (viewMode == 'songs') {
      return <MusicList listId={LOCAL_LIST_ID} paging={isLandscape} />
    }
    return (
      <GroupView
        musics={musics}
        groupBy={viewMode}
        onPlay={handlePlay}
        paged={isLandscape}
        numColumns={listColumns} />
    )
  }

  // 【v38】视图入口图标（app 字体集 / Ionicons 补充集），激活态用主题色
  const renderTabIcon = (icon: TabIcon, active: boolean, size: number) => {
    const color = active ? theme['c-primary'] : theme['c-font-label']
    return icon.set == 'ion'
      ? <IconIon name={icon.name} size={size} color={color} />
      : <Icon name={icon.name} size={size} color={color} />
  }

  // 竖屏视图入口（顶部一行，【v38】同步图标：歌曲配音符，其余配图标）
  const renderPortraitTabs = () => (
    VIEW_TABS.map(tab => (
      <TouchableOpacity
        key={tab.id}
        style={[
          styles.tabItem,
          viewMode == tab.id ? { ...styles.tabActive, borderBottomColor: theme['c-primary'] } : null,
        ]}
        onPress={() => { setViewMode(tab.id) }}
      >
        <View style={styles.tabInner}>
          {tab.icon ? renderTabIcon(tab.icon, viewMode == tab.id, 14) : null}
          <Text numberOfLines={1} style={{ ...styles.tabText, color: viewMode == tab.id ? theme['c-primary'] : theme['c-font'] }}>
            {t(tab.labelKey)}
          </Text>
        </View>
      </TouchableOpacity>
    ))
  )

  // 横屏左侧控制栏的视图入口组（纵向排列，左侧竖线高亮，【v38】配图标）
  const renderLandscapeTabs = () => (
    VIEW_TABS.map(tab => (
      <TouchableOpacity
        key={tab.id}
        style={[
          styles.sideItem,
          viewMode == tab.id ? { ...styles.sideItemActive, borderLeftColor: theme['c-primary'] } : null,
        ]}
        onPress={() => { setViewMode(tab.id) }}
      >
        {tab.icon ? renderTabIcon(tab.icon, viewMode == tab.id, 16) : null}
        <Text numberOfLines={1} style={{ ...styles.sideText, color: viewMode == tab.id ? theme['c-primary'] : theme['c-font'] }}>
          {t(tab.labelKey)}
        </Text>
      </TouchableOpacity>
    ))
  )

  return (
    // 【v39】不再画不透明底色：页面由 Home 的 PageContent 提供背景（主题背景图 /
    // 勾选"使用动态背景"时的当前歌曲封面模糊图），画底色会把这些背景盖住
    <View style={styles.container}>
      {
        isLandscape
          ? (
              // 【v37】横屏：左侧控制栏 + 右侧翻页列表。
              // 【v38】上下两组：视图入口组贴顶、扫描操作组贴底，中间弹性留白隔开
              <View style={styles.landRow}>
                <View style={{ ...styles.sideCol, borderRightColor: theme['c-border'] }}>
                  {renderLandscapeTabs()}
                  <View style={styles.sideGap} />
                  <TouchableOpacity style={styles.sideItem} onPress={() => { setShowFolderPicker(true) }}>
                    <Icon name="add_folder" size={16} color={theme['c-primary']} />
                    <Text numberOfLines={1} style={{ ...styles.sideText, color: theme['c-primary'] }}>
                      {scanExcluded.length
                        ? t('local_music_folder_n', { n: scanExcluded.length })
                        : t('local_music_pick_folder')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sideItem} onPress={handleScan} disabled={isScanning}>
                    <Icon name="search-2" size={16} color={isScanning ? theme['c-350'] : theme['c-primary']} />
                    <Text numberOfLines={1} style={{ ...styles.sideText, color: isScanning ? theme['c-350'] : theme['c-primary'] }}>
                      {isScanning ? t('local_music_scanning') : t('local_music_scan')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.landContent}>
                  {renderContent()}
                </View>
              </View>
            )
          : (
              // 竖屏：保持现有布局（顶部一行 tabs + 操作按钮），歌曲上下滚动
              <>
                <View style={{ ...styles.header, borderBottomColor: theme['c-border'] }}>
                  {renderPortraitTabs()}
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
                {renderContent()}
              </>
            )
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
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
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
  // 【v37】横屏布局
  landRow: {
    flex: 1,
    flexDirection: 'row',
  },
  sideCol: {
    width: 132,
    borderRightWidth: BorderWidths.normal,
    paddingTop: 6,
    paddingBottom: 10,
  },
  sideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  sideItemActive: {},
  sideText: {
    fontSize: 13,
    flex: 1,
  },
  // 【v38】视图组与扫描组之间的弹性留白
  sideGap: {
    flex: 1,
  },
  landContent: {
    flex: 1,
  },
})
