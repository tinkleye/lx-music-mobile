import { useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native'

import Section from '../../components/Section'
import CheckBoxItem from '../../components/CheckBoxItem'
import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import {
  getDownloadDirCandidatesGrouped,
  getDownloadDir,
  getQualityLabel,
  QUALITY_ORDER,
} from '@/core/download'
import DirBrowser, { type DirBrowserType } from './DirBrowser'

const CONCURRENCY_OPTIONS = [1, 2, 3, 4, 5, 6]
const FILE_NAME_OPTIONS: LX.AppSetting['download.fileName'][] = ['歌名 - 歌手', '歌手 - 歌名', '歌名']

// 路径展示美化：内置存储前缀替换为可读名，U盘卷名保留
const displayPath = (p: string, storageLabel: string, usbLabel: string) => {
  if (p.startsWith('/storage/emulated/0/')) return p.replace('/storage/emulated/0/', `${storageLabel}/`)
  if (p == '/storage/emulated/0') return storageLabel
  const m = p.match(/^\/storage\/([A-Za-z0-9-]{4,})(\/|$)/)
  if (m) return p.replace(`/storage/${m[1]}/`, `${usbLabel}/`).replace(`/storage/${m[1]}`, usbLabel)
  return p
}

/**
 * 【v43】下载设置：目录 / 音质 / 文件名 / 内嵌标签 / 附加文件 / 并发 / 换源。
 * 【v44】音质 / 文件名 / 并发 改为平铺勾选（参考车友版），去掉弹窗；
 *        目录改为「显示当前目录 + 更改目录按钮」，选择弹窗去自定义输入，内置/U盘分组展示。
 */
export default () => {
  const t = useI18n()
  const theme = useTheme()
  // 【v55】目录选择弹窗按屏幕尺寸动态定宽高（车机大屏自适应，内容超高可滚动）
  const { width: winW, height: winH } = useWindowDimensions()
  const concurrency = useSettingValue('download.concurrency')
  const isAskQuality = useSettingValue('download.isAskQuality')
  const isAutoToggle = useSettingValue('download.isAutoToggleSource')
  const quality = useSettingValue('download.quality')
  const fileName = useSettingValue('download.fileName')
  const isEmbedCover = useSettingValue('download.isEmbedCover')
  const isEmbedLyric = useSettingValue('download.isEmbedLyric')
  const isSaveLrc = useSettingValue('download.isSaveLrc')
  const isSaveCover = useSettingValue('download.isSaveCover')
  const downloadDir = useSettingValue('download.dir')

  // 下载目录
  const dirDialogRef = useRef<DialogType>(null)
  const [dirGroups, setDirGroups] = useState<{ builtin: string[], usb: string[] }>({ builtin: [], usb: [] })
  const openDirDialog = () => {
    dirDialogRef.current?.setVisible(true)
    void getDownloadDirCandidatesGrouped().then(setDirGroups)
  }
  // 【v45】任选路径浏览
  const dirBrowserRef = useRef<DirBrowserType>(null)
  const handleBrowseSelect = (path: string) => {
    updateSetting({ 'download.dir': path })
  }

  const qualityLabel = (q: LX.Quality | '') => (q === '' ? t('download_setting_quality_auto') : getQualityLabel(q))
  const nameLabel = (n: LX.AppSetting['download.fileName']) => {
    switch (n) {
      case '歌手 - 歌名': return t('download_setting_file_name_singer_title')
      case '歌名': return t('download_setting_file_name_title')
      default: return t('download_setting_file_name_title_singer')
    }
  }
  // 当前生效目录（展示用）
  const currentDir = getDownloadDir()

  const renderDirOption = (dir: string) => {
    const active = dir == currentDir
    return (
      <TouchableOpacity
        key={dir}
        style={{ ...styles.optionBtn, backgroundColor: active ? theme['c-primary-background-active'] : theme['c-button-background'] }}
        onPress={() => {
          updateSetting({ 'download.dir': dir })
          dirDialogRef.current?.setVisible(false)
        }}
      >
        <Text style={{ color: active ? theme['c-primary-font'] : theme['c-button-font'] }}>
          {displayPath(dir, t('local_music_storage'), t('local_music_usb'))}{active ? ` · ${t('roam_mode_current')}` : ''}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <Section title={t('setting_download')}>
      <View style={styles.content}>
        {/* 下载目录 */}
        <SubTitle title={t('download_setting_dir')}>
          <View style={styles.dirRow}>
            <Text size={13} color={theme['c-primary-font']} numberOfLines={1} style={styles.dirText}>
              {displayPath(currentDir, t('local_music_storage'), t('local_music_usb'))}
            </Text>
            <TouchableOpacity style={styles.dirChangeBtn} onPress={openDirDialog}>
              <Text size={13} color={theme['c-primary']}>{t('download_setting_dir_change')}</Text>
            </TouchableOpacity>
          </View>
        </SubTitle>

        {/* 默认下载音质：平铺勾选 */}
        <SubTitle title={t('download_setting_quality')}>
          <View style={styles.radioRow}>
            {(['', ...QUALITY_ORDER] as Array<LX.Quality | ''>).map(q => (
              <CheckBox
                key={q}
                check={quality == q}
                label={qualityLabel(q)}
                onChange={() => { updateSetting({ 'download.quality': q }) }}
                need
                marginRight={8} />
            ))}
          </View>
        </SubTitle>
        <CheckBoxItem
          check={isAskQuality}
          label={t('download_setting_ask_quality')}
          helpDesc={t('download_setting_ask_quality_desc')}
          onChange={val => { updateSetting({ 'download.isAskQuality': val }) }} />

        {/* 文件名格式：平铺勾选 */}
        <SubTitle title={t('download_setting_file_name')}>
          <View style={styles.radioRow}>
            {FILE_NAME_OPTIONS.map(n => (
              <CheckBox
                key={n}
                check={fileName == n}
                label={nameLabel(n)}
                onChange={() => { updateSetting({ 'download.fileName': n }) }}
                need
                marginRight={8} />
            ))}
          </View>
        </SubTitle>

        {/* 内嵌标签 */}
        <SubTitle title={t('download_setting_embed')} compact />
        <CheckBoxItem
          check={isEmbedCover}
          label={t('download_setting_embed_cover')}
          helpDesc={t('download_setting_embed_cover_desc')}
          onChange={val => { updateSetting({ 'download.isEmbedCover': val }) }} />
        <CheckBoxItem
          check={isEmbedLyric}
          label={t('download_setting_embed_lyric')}
          helpDesc={t('download_setting_embed_lyric_desc')}
          onChange={val => { updateSetting({ 'download.isEmbedLyric': val }) }} />

        {/* 附加文件 */}
        <SubTitle title={t('download_setting_extra')} compact />
        <CheckBoxItem
          check={isSaveLrc}
          label={t('download_setting_save_lrc')}
          helpDesc={t('download_setting_save_lrc_desc')}
          onChange={val => { updateSetting({ 'download.isSaveLrc': val }) }} />
        <CheckBoxItem
          check={isSaveCover}
          label={t('download_setting_save_cover')}
          helpDesc={t('download_setting_save_cover_desc')}
          onChange={val => { updateSetting({ 'download.isSaveCover': val }) }} />

        {/* 并发数：平铺勾选 1~6 */}
        <SubTitle title={t('download_setting_concurrency')}>
          <View style={styles.radioRow}>
            {CONCURRENCY_OPTIONS.map(num => (
              <CheckBox
                key={num}
                check={concurrency == num}
                label={`${num}`}
                onChange={() => { updateSetting({ 'download.concurrency': num }) }}
                need
                marginRight={8} />
            ))}
          </View>
        </SubTitle>

        <CheckBoxItem
          check={isAutoToggle}
          label={t('download_setting_auto_toggle')}
          helpDesc={t('download_setting_auto_toggle_desc')}
          onChange={val => { updateSetting({ 'download.isAutoToggleSource': val }) }} />
      </View>

      {/* 下载目录选择：内置 / U盘 分组，无自定义输入；内容可滚动、宽度按屏幕自适应 */}
      <Dialog ref={dirDialogRef} title={t('download_setting_dir')} width={Math.min(winW * 0.86, 520)}>
        <ScrollView style={{ maxHeight: Math.min(winH * 0.6, 480) }} showsVerticalScrollIndicator={false}>
          <View style={styles.optionBox}>
            {
              dirGroups.builtin.length ? (
                <>
                  <Text size={12} color={theme['c-font-label']}>{t('local_music_storage')}</Text>
                  {dirGroups.builtin.map(renderDirOption)}
                </>
              ) : null
            }
            {
              dirGroups.usb.length ? (
                <>
                  <Text size={12} color={theme['c-font-label']}>{t('local_music_usb')}</Text>
                  {dirGroups.usb.map(renderDirOption)}
                </>
              ) : null
            }
            <TouchableOpacity
              style={{ ...styles.optionBtn, backgroundColor: theme['c-button-background'] }}
              onPress={() => {
                updateSetting({ 'download.dir': '' })
                dirDialogRef.current?.setVisible(false)
              }}
            >
              <Text style={{ color: theme['c-button-font'] }}>{t('download_setting_dir_reset')}</Text>
            </TouchableOpacity>
            {/* 【v45】任选路径：进入目录浏览器，逐级选择任意目录 */}
            <TouchableOpacity
              style={{ ...styles.optionBtn, backgroundColor: theme['c-button-background'] }}
              onPress={() => {
                dirDialogRef.current?.setVisible(false)
                dirBrowserRef.current?.show()
              }}
            >
              <Text style={{ color: theme['c-button-font'] }}>{t('download_setting_dir_browse')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Dialog>
      <DirBrowser ref={dirBrowserRef} onSelect={handleBrowseSelect} />
    </Section>
  )
}

const styles = createStyle({
  content: {
    marginTop: 5,
  },
  optionBox: {
    paddingTop: 6,
    gap: 10,
  },
  optionBtn: {
    borderRadius: 6,
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'center',
  },
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dirText: {
    flex: 1,
    marginRight: 10,
  },
  dirChangeBtn: {
    paddingVertical: 4,
    paddingLeft: 8,
  },
})
