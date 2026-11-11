import { useState, useCallback } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { useI18n } from '@/lang'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { toast } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { LOCAL_LIST_ID, scanLocalMusic, type ScanResult } from '@/core/music/localLibrary'
import MusicList from '../Mylist/MusicList'

// 【车机改造】本地音乐视图：固定显示「本地音乐」列表（listId 锁定，与我的列表互不干扰）
export default () => {
  const t = useI18n()
  const theme = useTheme()
  const [isScanning, setIsScanning] = useState(false)

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

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }}>
      <View style={{ ...styles.header, borderColor: theme['c-border'] }}>
        <Text style={styles.title}>{t('local_music_title')}</Text>
        <TouchableOpacity style={styles.scanBtn} onPress={handleScan} disabled={isScanning}>
          <Icon name="add_folder" size={16} color={isScanning ? theme['c-350'] : theme['c-primary']} />
          <Text style={{ ...styles.scanText, color: isScanning ? theme['c-350'] : theme['c-primary'] }}>
            {isScanning ? t('local_music_scanning') : t('local_music_scan')}
          </Text>
        </TouchableOpacity>
      </View>
      <MusicList listId={LOCAL_LIST_ID} />
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
    justifyContent: 'space-between',
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: BorderWidths.normal,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanText: {
    fontSize: 13,
  },
})
