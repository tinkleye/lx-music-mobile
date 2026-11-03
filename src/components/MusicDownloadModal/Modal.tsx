import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

import Dialog, { type DialogType } from '@/components/common/Dialog'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { requestStoragePermission, toast } from '@/utils/tools'
import {
  getDownloadQualitys,
  getDownloadDirLabel,
  startDownload,
  DownloadCanceledError,
  type DownloadQuality,
  type DownloadTaskHandle,
} from '@/core/download'

export interface DownloadSelectInfo {
  musicInfo: LX.Music.MusicInfo
  /** 多选模式下选中的歌曲，长度 > 1 时视为批量下载 */
  selectedList: LX.Music.MusicInfo[]
}

export interface MusicDownloadModalProps {
  onDownloaded?: () => void
}
export interface MusicDownloadModalType {
  show: (info: DownloadSelectInfo) => void
}

type Stage = 'select' | 'running' | 'done' | 'error'

const formatBytes = (bytes: number) => {
  if (!bytes || bytes < 0) return '0M'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}K`
  return `${(bytes / 1024 / 1024).toFixed(1)}M`
}

export default forwardRef<MusicDownloadModalType, MusicDownloadModalProps>(({ onDownloaded }, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const playQuality = useSettingValue('player.playQuality')
  const dialogRef = useRef<DialogType>(null)
  const taskRef = useRef<DownloadTaskHandle | null>(null)
  const canceledRef = useRef(false)

  const [info, setInfo] = useState<DownloadSelectInfo | null>(null)
  const [qualitys, setQualitys] = useState<DownloadQuality[]>([])
  const [stage, setStage] = useState<Stage>('select')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentName, setCurrentName] = useState('')
  const [progress, setProgress] = useState({ loaded: 0, total: 0 })
  const [savedFiles, setSavedFiles] = useState<string[]>([])
  const [failedCount, setFailedCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [usedPublicDir, setUsedPublicDir] = useState(true)

  const songs = info
    ? (info.selectedList.length > 1 ? info.selectedList : [info.musicInfo])
    : []

  useImperativeHandle(ref, () => ({
    show(selectInfo) {
      setInfo(selectInfo)
      setQualitys(getDownloadQualitys(selectInfo.musicInfo))
      setStage('select')
      setCurrentIndex(0)
      setCurrentName('')
      setProgress({ loaded: 0, total: 0 })
      setSavedFiles([])
      setFailedCount(0)
      setErrorMsg('')
      setUsedPublicDir(true)
      requestAnimationFrame(() => {
        dialogRef.current?.setVisible(true)
      })
    },
  }))

  const handleHide = useCallback(() => {
    // 关掉弹窗时如果还在下载，直接中断，避免后台偷偷跑完又没有提示
    if (stage === 'running') {
      canceledRef.current = true
      taskRef.current?.cancel()
      taskRef.current = null
    }
    setStage('select')
    setInfo(null)
  }, [stage])

  const handleCancel = useCallback(() => {
    canceledRef.current = true
    taskRef.current?.cancel()
  }, [])

  const handleStart = useCallback(async(quality: LX.Quality) => {
    if (!info) return
    const list = info.selectedList.length > 1 ? info.selectedList : [info.musicInfo]
    if (!list.length) return

    // 核心层抛的是给日志看的英文原因，这里换成用户能读懂的说明
    const friendlyError = (msg: string) => {
      switch (msg) {
        case 'empty url': return t('download_failed_no_url')
        case 'invalid file': return t('download_failed_invalid')
        case 'no writable dir': return t('download_failed_no_storage')
        default: return msg
      }
    }

    // 没给权限也不拦着：公共目录写不进去时会自动退到 App 私有目录（那里不需要权限）
    const granted = await requestStoragePermission()
    if (granted === false) toast(t('download_permission_fallback'))

    canceledRef.current = false
    setStage('running')
    setSavedFiles([])
    setFailedCount(0)
    setErrorMsg('')
    setProgress({ loaded: 0, total: 0 })

    let saved = 0
    let failed = 0
    let lastError = ''
    for (let i = 0; i < list.length; i++) {
      if (canceledRef.current) break
      const musicInfo = list[i]
      setCurrentIndex(i)
      setCurrentName(musicInfo.name)
      setProgress({ loaded: 0, total: 0 })
      const task = startDownload({
        musicInfo,
        quality,
        onProgress: (p) => { setProgress(p) },
      })
      taskRef.current = task
      try {
        const res = await task.promise
        saved++
        setUsedPublicDir(res.isPublic)
        setSavedFiles(prev => [...prev, res.fileName])
      } catch (err) {
        if (err instanceof DownloadCanceledError || (err as Error)?.name === 'DownloadCanceledError') break
        failed++
        lastError = friendlyError((err as Error).message)
        console.log('download failed:', musicInfo.name, err)
      }
      taskRef.current = null
    }

    if (canceledRef.current) {
      setStage('select')
      return
    }

    setFailedCount(failed)
    if (saved > 0) {
      setStage('done')
      onDownloaded?.()
    } else {
      setErrorMsg(lastError || t('download_failed_no_storage'))
      setStage('error')
    }
  }, [info, onDownloaded, t])

  const qualityDesc = (quality: LX.Quality) => {
    switch (quality) {
      case 'flac24bit':
      case 'flac':
      case 'wav':
      case 'ape':
        return t('download_quality_lossless')
      case '320k':
      case '192k':
        return t('download_quality_high')
      default:
        return t('download_quality_standard')
    }
  }

  const percent = progress.total > 0
    ? Math.min(100, Math.round(progress.loaded / progress.total * 100))
    : 0

  const renderSelect = () => {
    if (!qualitys.length) {
      return <Text style={styles.empty} size={14} color={theme['c-font-label']}>{t('download_empty_quality')}</Text>
    }
    return (
      <>
        <ScrollView style={styles.qualityScroll} keyboardShouldPersistTaps="always">
          {
            qualitys.map((item) => {
              const isCurrent = item.quality == playQuality
              return (
                <TouchableOpacity
                  key={item.quality}
                  style={{ ...styles.qualityRow, borderBottomColor: theme['c-primary-light-200-alpha-700'] }}
                  activeOpacity={0.7}
                  onPress={() => { void handleStart(item.quality) }}
                >
                  <View style={styles.qualityLeft}>
                    <Text size={17}>{item.label}</Text>
                    <Text size={11} color={theme['c-font-label']} numberOfLines={1}>
                      {qualityDesc(item.quality)}{isCurrent ? ` · ${t('download_quality_current')}` : ''}
                    </Text>
                  </View>
                  <Text size={12} color={theme['c-font-label']}>{item.size ?? ''}</Text>
                </TouchableOpacity>
              )
            })
          }
        </ScrollView>
        <Text style={styles.hint} size={11} color={theme['c-font-label']} numberOfLines={1}>
          {t('download_save_to', { path: getDownloadDirLabel(true) })}
        </Text>
      </>
    )
  }

  const renderRunning = () => (
    <View style={styles.runningBox}>
      <Text size={15} numberOfLines={1} style={styles.runningName}>{currentName}</Text>
      <View style={{ ...styles.progressTrack, backgroundColor: theme['c-primary-light-200-alpha-700'] }}>
        <View style={{ ...styles.progressBar, width: `${Math.max(percent, 2)}%`, backgroundColor: theme['c-primary'] }} />
      </View>
      <View style={styles.progressInfo}>
        <Text size={12} color={theme['c-font-label']}>
          {`${percent}%  ${formatBytes(progress.loaded)} / ${progress.total > 0 ? formatBytes(progress.total) : '--'}`}
        </Text>
        {songs.length > 1
          ? <Text size={12} color={theme['c-font-label']}>{t('download_progress_of', { index: currentIndex + 1, count: songs.length })}</Text>
          : null}
      </View>
      <TouchableOpacity style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleCancel}>
        <Text size={14} color={theme['c-button-font']}>{t('download_cancel')}</Text>
      </TouchableOpacity>
    </View>
  )

  const renderDone = () => (
    <View style={styles.resultBox}>
      <Text size={16} color={theme['c-primary-font']}>{t('download_done', { count: savedFiles.length })}</Text>
      <ScrollView style={styles.fileScroll}>
        {
          savedFiles.map((name, index) => (
            <Text key={`${name}${index}`} size={12} color={theme['c-font-label']} numberOfLines={1} style={styles.fileName}>{name}</Text>
          ))
        }
      </ScrollView>
      <Text size={11} color={theme['c-font-label']} style={styles.hint}>
        {t('download_done_saved_to', { path: getDownloadDirLabel(usedPublicDir) })}
      </Text>
      {failedCount > 0
        ? <Text size={12} color={theme['c-font-label']}>{t('download_failed_skip', { count: failedCount })}</Text>
        : null}
      <TouchableOpacity
        style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }}
        onPress={() => { dialogRef.current?.setVisible(false) }}
      >
        <Text size={14} color={theme['c-button-font']}>{t('download_close')}</Text>
      </TouchableOpacity>
    </View>
  )

  const renderError = () => (
    <View style={styles.resultBox}>
      <Text size={15}>{t('download_failed', { msg: errorMsg })}</Text>
      <View style={styles.errorBtns}>
        <TouchableOpacity
          style={{ ...styles.btn, ...styles.btnHalf, backgroundColor: theme['c-button-background'] }}
          onPress={() => { setStage('select') }}
        >
          <Text size={14} color={theme['c-button-font']}>{t('download_retry')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ ...styles.btn, ...styles.btnHalf, backgroundColor: theme['c-button-background'] }}
          onPress={() => { dialogRef.current?.setVisible(false) }}
        >
          <Text size={14} color={theme['c-button-font']}>{t('download_close')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <Dialog
      ref={dialogRef}
      title={t('download_title')}
      onHide={handleHide}
      bgHide={stage !== 'running'}
      keyHide={stage !== 'running'}
      width={scaleSizeW(360)}
    >
      {
        info
          ? (
              <View style={styles.container}>
                <View style={styles.songInfo}>
                  <Text size={17} numberOfLines={1}>{info.musicInfo.name}</Text>
                  <Text size={12} color={theme['c-font-label']} numberOfLines={1}>{info.musicInfo.singer}</Text>
                  {songs.length > 1
                    ? <Text size={11} color={theme['c-font-label']}>{t('download_batch_tip', { count: songs.length })}</Text>
                    : null}
                </View>
                {stage === 'select' ? renderSelect() : null}
                {stage === 'running' ? renderRunning() : null}
                {stage === 'done' ? renderDone() : null}
                {stage === 'error' ? renderError() : null}
              </View>
            )
          : null
      }
    </Dialog>
  )
})

const styles = createStyle({
  container: {
    maxWidth: '92%',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 14,
  },
  songInfo: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  qualityScroll: {
    flexGrow: 0,
    maxHeight: scaleSizeH(260),
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  qualityLeft: {
    flexGrow: 1,
    flexShrink: 1,
  },
  empty: {
    paddingTop: 18,
    paddingBottom: 18,
    textAlign: 'center',
  },
  hint: {
    paddingTop: 10,
  },
  runningBox: {
    paddingTop: 10,
  },
  runningName: {
    paddingBottom: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 12,
  },
  resultBox: {
    paddingTop: 12,
  },
  fileScroll: {
    flexGrow: 0,
    maxHeight: scaleSizeH(150),
    paddingTop: 6,
  },
  fileName: {
    paddingBottom: 2,
  },
  errorBtns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  btn: {
    marginTop: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  btnHalf: {
    width: '48%',
  },
})
