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
  type DownloadQuality,
} from '@/core/download'
import { addDownloadTasks } from '@/core/downloadQueue'

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

type Stage = 'select' | 'queued'

export default forwardRef<MusicDownloadModalType, MusicDownloadModalProps>(({ onDownloaded }, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const playQuality = useSettingValue('player.playQuality')
  const dialogRef = useRef<DialogType>(null)
  const [queuedInfo, setQueuedInfo] = useState({ added: 0, skipped: 0 })

  const [info, setInfo] = useState<DownloadSelectInfo | null>(null)
  const [qualitys, setQualitys] = useState<DownloadQuality[]>([])
  const [stage, setStage] = useState<Stage>('select')

  const songs = info
    ? (info.selectedList.length > 1 ? info.selectedList : [info.musicInfo])
    : []

  useImperativeHandle(ref, () => ({
    show(selectInfo) {
      setInfo(selectInfo)
      setQualitys(getDownloadQualitys(selectInfo.musicInfo))
      setStage('select')
      requestAnimationFrame(() => {
        dialogRef.current?.setVisible(true)
      })
    },
  }))

  const handleHide = useCallback(() => {
    setStage('select')
    setInfo(null)
  }, [])

  /**
   * 【v42】选好音质后加入下载队列（不再在弹窗内串行下载），
   * 进度与重试在「下载任务面板」里看：本地音乐页控制区（横）/ 标题行入口（竖）。
   */
  const handleStart = useCallback(async(quality: LX.Quality) => {
    if (!info) return
    const list = info.selectedList.length > 1 ? info.selectedList : [info.musicInfo]
    if (!list.length) return

    // 没给权限也不拦着：公共目录写不进去时会自动退到 App 私有目录（那里不需要权限）
    const granted = await requestStoragePermission()
    if (granted === false) toast(t('download_permission_fallback'))

    const { added, skipped } = addDownloadTasks(list, quality)
    setQueuedInfo({ added, skipped })
    setStage('queued')
    if (added) onDownloaded?.()
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

  const renderQueued = () => (
    <View style={styles.resultBox}>
      <Text size={16} color={theme['c-primary-font']}>{t('download_queued_title', { count: queuedInfo.added })}</Text>
      {queuedInfo.skipped > 0 ? (
        <Text size={12} color={theme['c-font-label']} style={styles.hint}>{t('download_queued_skipped', { count: queuedInfo.skipped })}</Text>
      ) : null}
      <Text size={11} color={theme['c-font-label']} style={styles.hint}>{t('download_queued_hint')}</Text>
      <TouchableOpacity
        style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }}
        onPress={() => { dialogRef.current?.setVisible(false) }}
      >
        <Text size={14} color={theme['c-button-font']}>{t('download_close')}</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <Dialog
      ref={dialogRef}
      title={t('download_title')}
      onHide={handleHide}
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
                {stage === 'queued' ? renderQueued() : null}
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
