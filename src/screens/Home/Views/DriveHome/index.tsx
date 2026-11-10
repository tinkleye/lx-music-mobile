import { View, TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { setNavActiveId } from '@/core/common'
import type { InitState as CommonState } from '@/store/common/state'

// 【车机改造】驾驶首页：大卡片入口，防眩光、盲操作友好
type CardItem = { id: CommonState['navActiveId'], icon: string, labelKey: string }

const CARDS: CardItem[] = [
  { id: 'nav_songlist', icon: 'album', labelKey: 'nav_songlist' },
  { id: 'nav_local', icon: 'sd-card', labelKey: 'nav_local' },
  { id: 'nav_love', icon: 'love', labelKey: 'nav_love' },
  { id: 'nav_top', icon: 'leaderboard', labelKey: 'nav_top' },
  { id: 'nav_search', icon: 'search-2', labelKey: 'nav_search' },
  { id: 'nav_setting', icon: 'setting', labelKey: 'nav_setting' },
]

export default () => {
  const theme = useTheme()

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {CARDS.map(card => (
          <TouchableOpacity
            key={card.id}
            style={{ ...styles.card, backgroundColor: theme['c-primary-background-active'] }}
            onPress={() => { setNavActiveId(card.id) }}
            activeOpacity={0.7}
          >
            <Icon name={card.icon} size={40} color={theme['c-primary']} />
            <Text style={{ ...styles.label, color: theme['c-font'] }}>{global.i18n.t(card.labelKey)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
  },
  card: {
    width: scaleSizeW(260),
    height: scaleSizeH(170),
    borderRadius: 14,
    margin: scaleSizeW(12),
    justifyContent: 'center',
    alignItems: 'center',
    gap: scaleSizeH(14),
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
})
