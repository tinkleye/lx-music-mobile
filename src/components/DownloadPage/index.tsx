import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import type { Message } from '@/lang'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { getQualityLabel } from '@/core/download'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { playNext } from '@/core/player/player'
import playerState from '@/store/player/state'
import { LIST_IDS } from '@/config/constant'
import {
  subscribeDownloadTasks,
  getDownloadTasks,
  retryTask,
  pauseTask,
  resumeTask,
  removeTask,
  cancelTask,
  type DownloadTask,
  type DownloadTaskStatus,
} from '@/core/downloadQueue'

type TabKey = 'active' | 'done' | 'failed'

const TABS: { key: TabKey, labelKey: keyof Message }[] = [
  { key: 'active', labelKey: 'download_page_tab_active' },
  { key: 'done', labelKey: 'download_page_tab_done' },
  { key: 'failed', labelKey: 'download_page_tab_failed' },
]

const statusLabelKey: Record<DownloadTaskStatus, keyof Message> = {
  waiting: 'download_status_waiting',
  running: 'download_status_running',
  paused: 'download_status_paused',
  done: 'download_status_done',
  failed: 'download_status_failed',
  canceled: 'download_status_canceled',
}

const filterTasks = (tasks: DownloadTask[], tab: TabKey) => {
  switch (tab) {
    case 'active': return tasks.filter(t => t.status == 'waiting' || t.status == 'running' || t.status == 'paused')
    case 'done': return tasks.filter(t => t.status == 'done')
    case 'failed': return tasks.filter(t => t.status == 'failed' || t.status == 'canceled')
  }
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes < 0) return '0K'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}K`
  return `${(bytes / 1024 / 1024).toFixed(1)}M`
}

/** 【v51】从文件路径取扩展名（大写），无扩展名返回 '-' */
const formatOf = (path?: string) => {
  if (!path) return '-'
  const i = path.lastIndexOf('.')
  return i > 0 ? path.slice(i + 1).toUpperCase() : '-'
}

/** 【v51】属性弹窗里的一行：左标签 + 右值 */
const AttrRow = ({ label, value }: { label: string, value: string }) => {
  const theme = useTheme()
  return (
    <View style={styles.attrRow}>
      <Text size={12} color={theme['c-font-label']} style={styles.attrLabel}>{label}</Text>
      <Text size={12} color={theme['c-font']} style={styles.attrValue}>{value}</Text>
    </View>
  )
}

/**
 * 【v43】歌曲下载页面：下载中 / 已下载 / 下载失败 三个标签页，
 * 每页可勾选全部或部分，批量执行 开始 / 暂停 / 删除 / 重试。
 * 横屏嵌在本地音乐右侧内容区，竖屏嵌在本地音乐列表区。
 */
export default () => {
  const t = useI18n()
  const theme = useTheme()
  const [tasks, setTasks] = useState(getDownloadTasks())
  const [tab, setTab] = useState<TabKey>('active')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // 【v51】删除时是否同时删除本地文件（音频/歌词/封面），默认只删列表
  const [deleteFiles, setDeleteFiles] = useState(false)
  // 【v51】属性弹窗：当前查看属性的任务
  const [attrTask, setAttrTask] = useState<DownloadTask | null>(null)
  const attrDialogRef = useRef<DialogType>(null)

  useEffect(() => subscribeDownloadTasks(() => { setTasks([...getDownloadTasks()]) }), [])

  const list = useMemo(() => filterTasks(tasks, tab), [tasks, tab])

  // 切换标签时清空选中
  useEffect(() => { setSelected(new Set()) }, [tab])

  const allSelected = list.length > 0 && list.every(task => selected.has(task.id))

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(prev => {
      if (allSelected) return new Set()
      return new Set(list.map(task => task.id))
    })
  }

  const runOnSelected = (fn: (id: string) => void) => {
    selected.forEach(id => fn(id))
    setSelected(new Set())
  }

  // 【v51】播放已下载歌曲：加入稍后播放顶部并立即切换
  const playTask = (task: DownloadTask) => {
    const isPlaying = !!playerState.playMusicInfo.musicInfo
    addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo: task.musicInfo, isTop: true }])
    if (isPlaying) void playNext()
  }

  // 【v51】打开属性弹窗
  const openAttr = (task: DownloadTask) => {
    setAttrTask(task)
    attrDialogRef.current?.setVisible(true)
  }

  const renderTask = (task: DownloadTask) => {
    const percent = task.progress.total > 0 ? Math.min(100, Math.round(task.progress.loaded / task.progress.total * 100)) : 0
    const checked = selected.has(task.id)
    return (
      <View key={task.id} style={{ ...styles.row, borderBottomColor: theme['c-primary-light-100-alpha-200'] }}>
        <TouchableOpacity style={styles.checkBox} onPress={() => { toggleSelect(task.id) }}>
          <View style={{ ...styles.checkSquare, backgroundColor: checked ? theme['c-primary'] : 'transparent', borderColor: checked ? theme['c-primary'] : theme['c-500'] }}>
            {checked ? <Text size={12} color={theme['c-primary-font']}>✓</Text> : null}
          </View>
        </TouchableOpacity>
        <View style={styles.rowInfo}>
          <View style={styles.rowTitle}>
            <Text size={14} numberOfLines={1}>{task.musicInfo.name}</Text>
            {
              // 【v51】已下载项不再显示冗余的「已完成」状态文字（tab 已表明，右侧改为属性按钮）
              task.status != 'done' ? (
                <Text size={10} color={task.status == 'failed' ? theme['c-font-label'] : theme['c-primary-font']}>
                  {t(statusLabelKey[task.status])}
                </Text>
              ) : null
            }
          </View>
          <Text size={11} color={theme['c-font-label']} numberOfLines={1}>{task.musicInfo.singer}</Text>
          {
            task.status == 'running' ? (
              <View style={{ ...styles.track, backgroundColor: theme['c-primary-light-100-alpha-700'] }}>
                <View style={{ ...styles.bar, width: `${Math.max(percent, 2)}%`, backgroundColor: theme['c-primary'] }} />
              </View>
            ) : null
          }
          {
            task.status == 'running' ? (
              <Text size={10} color={theme['c-font-label']}>
                {`${percent}%  ${formatBytes(task.progress.loaded)}${task.progress.total > 0 ? ` / ${formatBytes(task.progress.total)}` : ''}`}
              </Text>
            ) : null
          }
          {
            task.status == 'failed' && task.error ? (
              <Text size={10} color={theme['c-font-label']} numberOfLines={1}>{task.error}</Text>
            ) : null
          }
        </View>
        <View style={styles.rowActions}>
          {
            // 【v51】已下载项右侧：播放 / 属性 / 删除
            task.status == 'done' ? (
              <>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { playTask(task) }}>
                  <Text size={11} color={theme['c-primary-font']}>{t('play')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { openAttr(task) }}>
                  <Text size={11} color={theme['c-primary-font']}>{t('download_action_attr')}</Text>
                </TouchableOpacity>
              </>
            ) : null
          }
          {
            task.status == 'running' || task.status == 'waiting' ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => { pauseTask(task.id) }}>
                <Text size={11} color={theme['c-font-label']}>{t('download_action_pause')}</Text>
              </TouchableOpacity>
            ) : null
          }
          {
            task.status == 'paused' ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => { resumeTask(task.id) }}>
                <Text size={11} color={theme['c-primary-font']}>{t('download_action_start')}</Text>
              </TouchableOpacity>
            ) : null
          }
          {
            task.status == 'failed' || task.status == 'canceled' ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => { retryTask(task.id) }}>
                <Text size={11} color={theme['c-primary-font']}>{t('download_action_retry')}</Text>
              </TouchableOpacity>
            ) : null
          }
          {
            task.status == 'running' || task.status == 'waiting' ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => { cancelTask(task.id) }}>
                <Text size={11} color={theme['c-font-label']}>{t('download_cancel')}</Text>
              </TouchableOpacity>
            ) : null
          }
          <TouchableOpacity style={styles.actionBtn} onPress={() => { removeTask(task.id, deleteFiles) }}>
            <Text size={11} color={theme['c-font-label']}>{t('download_action_delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={{ ...styles.tabs, borderBottomColor: theme['c-primary-light-100-alpha-200'] }}>
        {
          TABS.map(item => {
            const active = tab == item.key
            const count = filterTasks(tasks, item.key).length
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.tabItem, active ? { borderBottomColor: theme['c-primary'] } : null]}
                onPress={() => { setTab(item.key) }}
              >
                <Text size={13} color={active ? theme['c-primary'] : theme['c-font-label']}>
                  {t(item.labelKey)}{count > 0 ? ` ${count}` : ''}
                </Text>
              </TouchableOpacity>
            )
          })
        }
      </View>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {
          list.length == 0
            ? <Text size={12} color={theme['c-font-label']} style={styles.empty}>{t('download_task_empty')}</Text>
            : list.map(renderTask)
        }
      </ScrollView>
      <View style={{ ...styles.batchBar, borderTopColor: theme['c-primary-light-100-alpha-200'] }}>
        <TouchableOpacity style={styles.batchSelect} onPress={toggleSelectAll}>
          <View style={{ ...styles.checkSquare, backgroundColor: allSelected ? theme['c-primary'] : 'transparent', borderColor: allSelected ? theme['c-primary'] : theme['c-500'] }}>
            {allSelected ? <Text size={12} color={theme['c-primary-font']}>✓</Text> : null}
          </View>
          <Text size={12} color={theme['c-font-label']}>{t('download_page_select_all')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.batchBtn, selected.size == 0 ? { opacity: 0.4 } : null]}
          disabled={selected.size == 0}
          onPress={() => { runOnSelected(resumeTask) }}
        >
          <Text size={12} color={theme['c-primary-font']}>{t('download_action_start')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.batchBtn, selected.size == 0 ? { opacity: 0.4 } : null]}
          disabled={selected.size == 0}
          onPress={() => { runOnSelected(pauseTask) }}
        >
          <Text size={12} color={theme['c-primary-font']}>{t('download_action_pause')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.batchBtn, selected.size == 0 ? { opacity: 0.4 } : null]}
          disabled={selected.size == 0}
          onPress={() => { runOnSelected(retryTask) }}
        >
          <Text size={12} color={theme['c-primary-font']}>{t('download_action_retry')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.batchBtn, selected.size == 0 ? { opacity: 0.4 } : null]}
          disabled={selected.size == 0}
          onPress={() => { runOnSelected(id => removeTask(id, deleteFiles)) }}
        >
          <Text size={12} color={theme['c-font-label']}>{t('download_action_delete')}</Text>
        </TouchableOpacity>
        {/* 【v51】删除按钮旁的「同时删除本地文件」勾选项：勾选后删除才彻底删音频/歌词/封面 */}
        <TouchableOpacity style={styles.batchDeleteFiles} onPress={() => { setDeleteFiles(v => !v) }}>
          <View style={{ ...styles.checkSquare, backgroundColor: deleteFiles ? theme['c-primary'] : 'transparent', borderColor: deleteFiles ? theme['c-primary'] : theme['c-500'] }}>
            {deleteFiles ? <Text size={12} color={theme['c-primary-font']}>✓</Text> : null}
          </View>
          <Text size={12} color={theme['c-font-label']}>{t('download_delete_files')}</Text>
        </TouchableOpacity>
      </View>

      {/* 【v51】歌曲属性弹窗 */}
      <Dialog ref={attrDialogRef} title={t('download_attr_title')} width={380}>
        <View style={styles.attrBox}>
          {
            attrTask ? (
              <>
                <AttrRow label={t('download_attr_name')} value={attrTask.musicInfo.name} />
                <AttrRow label={t('download_attr_singer')} value={attrTask.musicInfo.singer} />
                <AttrRow label={t('download_attr_album')} value={attrTask.musicInfo.meta.albumName || '-'} />
                <AttrRow label={t('download_attr_quality')} value={getQualityLabel(attrTask.quality)} />
                <AttrRow label={t('download_attr_duration')} value={attrTask.musicInfo.interval || '-'} />
                <AttrRow label={t('download_attr_format')} value={formatOf(attrTask.filePath)} />
                <AttrRow label={t('download_attr_size')} value={formatBytes(attrTask.progress.total)} />
                <AttrRow label={t('download_attr_path')} value={attrTask.filePath || '-'} />
              </>
            ) : null
          }
        </View>
      </Dialog>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: BorderWidths.normal,
  },
  tabItem: {
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  list: {
    flex: 1,
    paddingHorizontal: 4,
  },
  empty: {
    paddingTop: 16,
    paddingBottom: 16,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: BorderWidths.normal,
  },
  checkBox: {
    paddingRight: 8,
  },
  checkSquare: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    flexShrink: 1,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  bar: {
    height: 5,
    borderRadius: 3,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  actionBtn: {
    paddingHorizontal: 4,
  },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 4,
    borderTopWidth: BorderWidths.normal,
  },
  batchSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 4,
  },
  batchBtn: {
    paddingHorizontal: 4,
  },
  // 【v51】底部删除按钮旁的「同时删除本地文件」勾选项
  batchDeleteFiles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  // 【v51】属性弹窗
  attrBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  attrLabel: {
    width: 60,
    flexShrink: 0,
    lineHeight: 18,
  },
  attrValue: {
    flex: 1,
    lineHeight: 18,
  },
})
