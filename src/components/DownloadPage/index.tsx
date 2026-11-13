import { useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import type { Message } from '@/lang'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
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
            <Text size={10} color={task.status == 'failed' ? theme['c-font-label'] : theme['c-primary-font']}>
              {t(statusLabelKey[task.status])}
            </Text>
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
          <TouchableOpacity style={styles.actionBtn} onPress={() => { removeTask(task.id) }}>
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
          onPress={() => { runOnSelected(removeTask) }}
        >
          <Text size={12} color={theme['c-font-label']}>{t('download_action_delete')}</Text>
        </TouchableOpacity>
      </View>
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
})
