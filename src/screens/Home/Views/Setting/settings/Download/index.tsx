import { useRef, useState } from 'react'
import { TextInput, TouchableOpacity, View } from 'react-native'

import Section from '../../components/Section'
import CheckBoxItem from '../../components/CheckBoxItem'
import SubTitle from '../../components/SubTitle'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import {
  getDownloadDirCandidates,
  getDownloadDir,
  getQualityLabel,
  QUALITY_ORDER,
} from '@/core/download'

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
 */
export default () => {
  const t = useI18n()
  const theme = useTheme()
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
  const [candidates, setCandidates] = useState<string[]>([])
  const [pickedDir, setPickedDir] = useState('')
  const [customDir, setCustomDir] = useState('')
  const openDirDialog = () => {
    const current = downloadDir || ''
    setPickedDir(current)
    setCustomDir(current)
    dirDialogRef.current?.setVisible(true)
    void getDownloadDirCandidates().then(setCandidates)
  }

  // 音质
  const qualityDialogRef = useRef<DialogType>(null)
  const [pickedQuality, setPickedQuality] = useState<LX.Quality | ''>(quality)

  // 文件名
  const nameDialogRef = useRef<DialogType>(null)
  const [pickedName, setPickedName] = useState<LX.AppSetting['download.fileName']>(fileName)

  // 并发
  const concDialogRef = useRef<DialogType>(null)
  const [pickedConc, setPickedConc] = useState(concurrency)

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

  return (
    <Section title={t('setting_download')}>
      <View style={styles.content}>
        {/* 下载目录 */}
        <SubTitle title={t('download_setting_dir')}>
          <TouchableOpacity onPress={openDirDialog}>
            <Text size={14} color={theme['c-primary-font']} numberOfLines={1}>
              {displayPath(currentDir, t('local_music_storage'), t('local_music_usb'))}
            </Text>
          </TouchableOpacity>
        </SubTitle>

        {/* 默认下载音质 */}
        <SubTitle title={t('download_setting_quality')}>
          <TouchableOpacity onPress={() => { setPickedQuality(quality); qualityDialogRef.current?.setVisible(true) }}>
            <Text size={14} color={theme['c-primary-font']}>{qualityLabel(quality)}</Text>
          </TouchableOpacity>
        </SubTitle>
        <CheckBoxItem
          check={isAskQuality}
          label={t('download_setting_ask_quality')}
          helpDesc={t('download_setting_ask_quality_desc')}
          onChange={val => { updateSetting({ 'download.isAskQuality': val }) }} />

        {/* 文件名格式 */}
        <SubTitle title={t('download_setting_file_name')}>
          <TouchableOpacity onPress={() => { setPickedName(fileName); nameDialogRef.current?.setVisible(true) }}>
            <Text size={14} color={theme['c-primary-font']}>{nameLabel(fileName)}</Text>
          </TouchableOpacity>
        </SubTitle>

        {/* 内嵌标签 */}
        <SubTitle title={t('download_setting_embed')}>{null}</SubTitle>
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
        <SubTitle title={t('download_setting_extra')}>{null}</SubTitle>
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

        {/* 并发数 */}
        <SubTitle title={t('download_setting_concurrency')}>
          <TouchableOpacity onPress={() => { setPickedConc(concurrency); concDialogRef.current?.setVisible(true) }}>
            <Text size={14} color={theme['c-primary-font']}>{t('download_setting_concurrency_value', { count: concurrency })}</Text>
          </TouchableOpacity>
        </SubTitle>

        <CheckBoxItem
          check={isAutoToggle}
          label={t('download_setting_auto_toggle')}
          helpDesc={t('download_setting_auto_toggle_desc')}
          onChange={val => { updateSetting({ 'download.isAutoToggleSource': val }) }} />
      </View>

      {/* 下载目录选择 */}
      <Dialog ref={dirDialogRef} title={t('download_setting_dir')} width={460}>
        <View style={styles.optionBox}>
          {
            candidates.map(dir => {
              const sel = (customDir.trim() || pickedDir).trim()
              const active = dir == (sel || getDownloadDir())
              return (
                <TouchableOpacity
                  key={dir}
                  style={{ ...styles.optionBtn, backgroundColor: active ? theme['c-primary-background-active'] : theme['c-button-background'] }}
                  onPress={() => { setPickedDir(dir); setCustomDir('') }}
                >
                  <Text style={{ color: active ? theme['c-primary-font'] : theme['c-button-font'] }}>
                    {displayPath(dir, t('local_music_storage'), t('local_music_usb'))}{active ? ` · ${t('roam_mode_current')}` : ''}
                  </Text>
                </TouchableOpacity>
              )
            })
          }
          <Text size={12} color={theme['c-font-label']}>{t('download_setting_dir_custom')}</Text>
          <TextInput
            style={{ ...styles.input, color: theme['c-font'], borderColor: theme['c-primary-light-100-alpha-200'] }}
            value={customDir}
            placeholder="/storage/emulated/0/Music/LX音乐"
            placeholderTextColor={theme['c-font-label']}
            onChangeText={text => { setCustomDir(text); setPickedDir(text) }}
          />
          <TouchableOpacity
            style={{ ...styles.optionBtn, backgroundColor: theme['c-button-background'] }}
            onPress={() => { setPickedDir(''); setCustomDir('') }}
          >
            <Text style={{ color: theme['c-button-font'] }}>{t('download_setting_dir_reset')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ ...styles.optionBtn, backgroundColor: theme['c-primary'] }}
            onPress={() => {
              updateSetting({ 'download.dir': (customDir.trim() || pickedDir).trim() })
              dirDialogRef.current?.setVisible(false)
            }}
          >
            <Text style={{ color: theme['c-primary-font'] }}>{t('confirm')}</Text>
          </TouchableOpacity>
        </View>
      </Dialog>

      {/* 默认音质选择 */}
      <Dialog ref={qualityDialogRef} title={t('download_setting_quality')} width={320}>
        <View style={styles.optionBox}>
          {(['', ...QUALITY_ORDER] as Array<LX.Quality | ''>).map(q => (
            <TouchableOpacity
              key={q}
              style={{ ...styles.optionBtn, backgroundColor: pickedQuality == q ? theme['c-primary-background-active'] : theme['c-button-background'] }}
              onPress={() => { setPickedQuality(q) }}
            >
              <Text style={{ color: pickedQuality == q ? theme['c-primary-font'] : theme['c-button-font'] }}>
                {qualityLabel(q)}{pickedQuality == q ? ` · ${t('roam_mode_current')}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={{ ...styles.optionBtn, backgroundColor: theme['c-primary'] }}
            onPress={() => {
              updateSetting({ 'download.quality': pickedQuality })
              qualityDialogRef.current?.setVisible(false)
            }}
          >
            <Text style={{ color: theme['c-primary-font'] }}>{t('confirm')}</Text>
          </TouchableOpacity>
        </View>
      </Dialog>

      {/* 文件名格式选择 */}
      <Dialog ref={nameDialogRef} title={t('download_setting_file_name')} width={320}>
        <View style={styles.optionBox}>
          {FILE_NAME_OPTIONS.map(n => (
            <TouchableOpacity
              key={n}
              style={{ ...styles.optionBtn, backgroundColor: pickedName == n ? theme['c-primary-background-active'] : theme['c-button-background'] }}
              onPress={() => { setPickedName(n) }}
            >
              <Text style={{ color: pickedName == n ? theme['c-primary-font'] : theme['c-button-font'] }}>
                {nameLabel(n)}{pickedName == n ? ` · ${t('roam_mode_current')}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={{ ...styles.optionBtn, backgroundColor: theme['c-primary'] }}
            onPress={() => {
              updateSetting({ 'download.fileName': pickedName })
              nameDialogRef.current?.setVisible(false)
            }}
          >
            <Text style={{ color: theme['c-primary-font'] }}>{t('confirm')}</Text>
          </TouchableOpacity>
        </View>
      </Dialog>

      {/* 并发数选择 */}
      <Dialog ref={concDialogRef} title={t('download_setting_concurrency')} width={320}>
        <View style={styles.optionBox}>
          {CONCURRENCY_OPTIONS.map(num => (
            <TouchableOpacity
              key={num}
              style={{ ...styles.optionBtn, backgroundColor: pickedConc == num ? theme['c-primary-background-active'] : theme['c-button-background'] }}
              onPress={() => { setPickedConc(num) }}
            >
              <Text style={{ color: pickedConc == num ? theme['c-primary-font'] : theme['c-button-font'] }}>
                {`${num}${pickedConc == num ? ` · ${t('roam_mode_current')}` : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={{ ...styles.optionBtn, backgroundColor: theme['c-primary'] }}
            onPress={() => {
              updateSetting({ 'download.concurrency': pickedConc })
              concDialogRef.current?.setVisible(false)
            }}
          >
            <Text style={{ color: theme['c-primary-font'] }}>{t('confirm')}</Text>
          </TouchableOpacity>
        </View>
      </Dialog>
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
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
})
