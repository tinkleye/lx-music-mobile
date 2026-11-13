import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import type { Message } from '@/lang'
import { createStyle } from '@/utils/tools'
import {
  subscribeDownloadTasks,
  getDownloadTasks,
  retryTask,
  cancelTask,
  removeTask,
  clearFinishedTasks,
  cancelAllTasks,
  type DownloadTask,
} from '@/core/downloadQueue'

export interface DownloadTaskPanelType {
  show: () => void
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes < 0) return '0K'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}K`
  return `${(bytes / 1024 / 1024).toFixed(1)}M`
}

const statusLabelKey: Record<DownloadTask['status'], keyof Message> = {
  waiting: 'download_status_waiting',
  running: 'download_status_running',
  paused: 'download_status_paused',
  done: 'download_status_done',
  failed: 'download_status_failed',
  canceled: 'download_status_canceled',
}

const TaskRow = ({ task, theme, t }: { task: DownloadTask, theme: ReturnType<typeof useTheme>, t: ReturnType<typeof useI18n> }) => {
  const percent = task.progress.total > 0 ? Math.min(100, Math.round(task.progress.loaded / task.progress.total * 100)) : 0
  return (
    <View style={styles.row}>
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
          task.status == 'failed' || task.status == 'canceled' ? (
            <TouchableOpacity style={styles.actionBtn} onPress={() => { retryTask(task.id) }}>
              <Text size={11} color={theme['c-primary-font']}>{t('download_retry')}</Text>
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
          <Text size={11} color={theme['c-font-label']}>{t('download_remove')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

/**
 * 【v42】下载任务面板：等待 / 下载中（进度）/ 失败（重试）。
 * 横屏嵌在本地音乐页左栏（扫描范围上方）；竖屏从标题行最右侧入口弹出。
 */
export default forwardRef<DownloadTaskPanelType, {}>((props, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const [tasks, setTasks] = useState(getDownloadTasks())

  useEffect(() => subscribeDownloadTasks(() => { setTasks([...getDownloadTasks()]) }), [])

  useImperativeHandle(ref, () => ({
    show() {
      setTasks([...getDownloadTasks()])
    },
  }))

  if (!tasks.length) {
    return (
      <View style={styles.emptyBox}>
        <Text size={12} color={theme['c-font-label']}>{t('download_task_empty')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text size={13}>{t('download_task_title', { count: tasks.length })}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => { cancelAllTasks() }}>
            <Text size={11} color={theme['c-font-label']}>{t('download_cancel_all')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { clearFinishedTasks() }}>
            <Text size={11} color={theme['c-font-label']}>{t('download_clear_done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {tasks.map(task => <TaskRow key={task.id} task={task} theme={theme} t={t} />)}
      </ScrollView>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    minHeight: 90,
    maxHeight: 260,
  },
  emptyBox: {
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
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
    gap: 8,
    marginLeft: 8,
  },
  actionBtn: {
    paddingHorizontal: 4,
  },
})
