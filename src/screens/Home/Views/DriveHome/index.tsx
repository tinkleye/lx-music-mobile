import { ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { setNavActiveId } from '@/core/common'
import type { InitState as CommonState } from '@/store/common/state'

// 【车机改造】驾驶首页：大卡片入口，防眩光、盲操作友好
// 【v32】卡片尺寸响应式：横屏 3 列 / 竖屏 2 列，任何屏幕都正好铺满
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
  const { width: winW } = useWindowDimensions()

  // 宽屏 3 列、窄屏 2 列；卡片宽度按剩余空间均分，高度用宽高比锁定
  const columns = winW >= 640 ? 3 : 2
  const GAP = 12
  const PAD = 14
  const cardW = Math.floor((winW - PAD * 2 - GAP * (columns - 1)) / columns)
  const cardH = Math.floor(cardW * 0.64)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.grid}>
        {CARDS.map(card => (
          <TouchableOpacity
            key={card.id}
            style={{
              ...styles.card,
              width: cardW,
              height: cardH,
              marginHorizontal: GAP / 2,
              marginVertical: GAP / 2,
              backgroundColor: theme['c-primary-background-active'],
            }}
            onPress={() => { setNavActiveId(card.id) }}
            activeOpacity={0.7}
          >
            <Icon name={card.icon} size={Math.floor(cardH * 0.38)} color={theme['c-primary']} />
            <Text style={{ ...styles.label, color: theme['c-font'] }}>{global.i18n.t(card.labelKey)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 14,
    paddingBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
})
