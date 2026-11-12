import { useState } from 'react'
import { TouchableOpacity, View, type LayoutChangeEvent } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { setNavActiveId } from '@/core/common'
import type { InitState as CommonState } from '@/store/common/state'

// 【车机改造】驾驶首页：大卡片入口，防眩光、盲操作友好
// 【v35】卡片尺寸按 onLayout 实测的内容区宽高强制计算（不再依赖窗口尺寸——
// 横屏左侧有导航栏占位，按窗口宽算出的 3 列卡片会溢出变成 2×2）：
// 横屏 3列×2行 / 竖屏 2列×3行 正好铺满一屏不滚动；图标与文字随容器缩放。
// 超过一页（6 个）时用 PagerView 左右滑动翻页（参考歌单横向翻页逻辑），
// 并在底部显示分页指示点。
type CardItem = { id: CommonState['navActiveId'], icon: string, labelKey: string }

const CARDS: CardItem[] = [
  { id: 'nav_songlist', icon: 'album', labelKey: 'nav_songlist' },
  { id: 'nav_local', icon: 'sd-card', labelKey: 'nav_local' },
  { id: 'nav_love', icon: 'love', labelKey: 'nav_love' },
  { id: 'nav_top', icon: 'leaderboard', labelKey: 'nav_top' },
  { id: 'nav_search', icon: 'search-2', labelKey: 'nav_search' },
  { id: 'nav_setting', icon: 'setting', labelKey: 'nav_setting' },
]

const GAP = 12
const PAD = 16

const onPageSelected = (setPage: (n: number) => void) => (e: PagerViewOnPageSelectedEvent) => {
  setPage(e.nativeEvent.position)
}

export default () => {
  const theme = useTheme()
  const [page, setPage] = useState(0)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize(prev => (prev.w == Math.round(width) && prev.h == Math.round(height) ? prev : { w: Math.round(width), h: Math.round(height) }))
  }

  const isLandscape = size.w > size.h
  const columns = isLandscape ? 3 : 2
  const rows = isLandscape ? 2 : 3
  const pageSize = columns * rows

  const pages: CardItem[][] = []
  for (let i = 0; i < CARDS.length; i += pageSize) pages.push(CARDS.slice(i, i + pageSize))

  // 卡片尺寸按内容区实测宽高强制计算：宽按列数、高按行数均分，正好铺满
  const cardW = Math.floor((size.w - PAD * 2 - GAP * (columns - 1)) / columns)
  const cardH = Math.floor((size.h - PAD * 2 - GAP * (rows - 1)) / rows) - 4
  const iconSize = Math.floor(Math.min(cardW, cardH) * 0.32)
  const fontSize = Math.max(14, Math.min(22, Math.round(Math.min(cardW, cardH) * 0.13)))

  const renderGrid = (cards: CardItem[]) => (
    <View style={styles.grid}>
      {
        cards.map(card => (
          <TouchableOpacity
            key={card.id}
            style={{
              ...styles.card,
              width: cardW,
              height: cardH,
              backgroundColor: theme['c-primary-background-active'],
            }}
            onPress={() => { setNavActiveId(card.id) }}
            activeOpacity={0.7}
          >
            <Icon name={card.icon} size={iconSize} color={theme['c-primary']} />
            <Text style={{ ...styles.label, fontSize, color: theme['c-font'] }}>{global.i18n.t(card.labelKey)}</Text>
          </TouchableOpacity>
        ))
      }
    </View>
  )

  const renderBody = () => {
    if (size.w <= 0 || size.h <= 0 || cardW <= 0 || cardH <= 0) return null
    if (pages.length <= 1) return renderGrid(pages[0])
    return (
      <>
        <PagerView style={styles.pager} initialPage={0} onPageSelected={onPageSelected(setPage)}>
          {pages.map((cards, i) => (
            <View key={i} style={styles.page}>
              {renderGrid(cards)}
            </View>
          ))}
        </PagerView>
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <View
              key={i}
              style={{
                ...styles.dot,
                backgroundColor: i == page ? theme['c-primary'] : theme['c-300'],
              }} />
          ))}
        </View>
      </>
    )
  }

  return <View style={styles.container} onLayout={handleLayout}>{renderBody()}</View>
}

const styles = createStyle({
  container: {
    flex: 1,
    // 【v36】单页网格垂直居中：卡片计算余量上下均分，不再全部堆在底部
    justifyContent: 'center',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: PAD,
    gap: GAP,
  },
  card: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontWeight: '600',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})
