import { useRef, useState } from 'react'
import { TouchableOpacity, View, type LayoutChangeEvent } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { setNavActiveId, updateSetting } from '@/core/common'
import { startRoam, endRoam, getRoamState, nextRoamBatch } from '@/core/roam'
import settingState from '@/store/setting/state'
import { useI18n } from '@/lang'
import type { Message } from '@/lang'
import type { InitState as CommonState } from '@/store/common/state'

// 【车机改造】驾驶首页：大卡片入口，防眩光、盲操作友好
// 【v35】卡片尺寸按 onLayout 实测的内容区宽高强制计算（不再依赖窗口尺寸——
// 横屏左侧有导航栏占位，按窗口宽算出的 3 列卡片会溢出变成 2×2）：
// 横屏 3列×2行 / 竖屏 2列×3行 正好铺满一屏不滚动；图标与文字随容器缩放。
// 超过一页（6 个）时用 PagerView 左右滑动翻页（参考歌单横向翻页逻辑），
// 并在底部显示分页指示点。
type CardItem = { id: CommonState['navActiveId'], icon: string, labelKey: keyof Message }

const CARDS: CardItem[] = [
  { id: 'nav_songlist', icon: 'album', labelKey: 'nav_songlist' },
  { id: 'nav_local', icon: 'sd-card', labelKey: 'nav_local' },
  { id: 'nav_love', icon: 'love', labelKey: 'nav_love' },
  { id: 'nav_top', icon: 'leaderboard', labelKey: 'nav_top' },
  { id: 'nav_search', icon: 'search-2', labelKey: 'nav_search' },
  { id: 'nav_roam', icon: 'list-random', labelKey: 'nav_roam' },
  // 【v43】驾驶舱不显示设置入口
]

const GAP = 12
const PAD = 16

const onPageSelected = (setPage: (n: number) => void) => (e: PagerViewOnPageSelectedEvent) => {
  setPage(e.nativeEvent.position)
}

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const [page, setPage] = useState(0)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const roamDialogRef = useRef<DialogType>(null)
  const roamMode = settingState.setting['roam.mode']

  // 【v44】漫游档位：大模块按钮用「标题 + 说明」两行展示
  const roamModeTitle = (mode: string) => {
    switch (mode) {
      case 'conservative': return t('roam_mode_conservative_title')
      case 'explorative': return t('roam_mode_explorative_title')
      default: return t('roam_mode_balanced_title')
    }
  }
  const roamModeDesc = (mode: string) => {
    switch (mode) {
      case 'conservative': return t('roam_mode_conservative_desc')
      case 'explorative': return t('roam_mode_explorative_desc')
      default: return t('roam_mode_balanced_desc')
    }
  }

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

  // 卡片尺寸按内容区实测宽高强制计算：宽按列数、高按行数均分，正好铺满。
  // 【v41】宽度减 2px：低密度车机屏上 Yoga 像素取整可能让 3 张卡累计溢出几 px
  const cardW = Math.floor((size.w - PAD * 2 - GAP * (columns - 1)) / columns) - 2
  const cardH = Math.floor((size.h - PAD * 2 - GAP * (rows - 1)) / rows) - 4
  const iconSize = Math.floor(Math.min(cardW, cardH) * 0.32)
  const fontSize = Math.max(14, Math.min(22, Math.round(Math.min(cardW, cardH) * 0.13)))

  // 【v41】显式分行渲染：不再依赖 flexWrap 折行（wrap 在低密度屏上会因
  // 取整误差把最后一张卡挤到下一行），每行固定 columns 张，物理上不可能换行错乱
  // 【v42】歌曲漫游：点击卡片 = 开始漫游 / 换一批；长按 = 档位选择与结束漫游
  const isRoamCard = (id: string) => id == 'nav_roam'

  const handleRoamPress = () => {
    void startRoam()
  }

  const handleModeSelect = (mode: 'conservative' | 'balanced' | 'explorative') => {
    void updateSetting({ 'roam.mode': mode })
    toast(t('roam_mode_changed_tip'))
    roamDialogRef.current?.setVisible(false)
    void startRoam()
  }

  const handleEndRoam = () => {
    void endRoam()
    toast(t('roam_ended_tip'))
    roamDialogRef.current?.setVisible(false)
  }

  const renderGrid = (cards: CardItem[]) => {
    const gridRows: CardItem[][] = []
    for (let i = 0; i < cards.length; i += columns) gridRows.push(cards.slice(i, i + columns))
    return (
      <View style={styles.grid}>
        {
          gridRows.map((rowCards, rowIndex) => (
            <View key={rowIndex} style={styles.gridRow}>
              {
                rowCards.map(card => (
                  <TouchableOpacity
                    key={card.id}
                    style={{
                      ...styles.card,
                      width: cardW,
                      height: cardH,
                      backgroundColor: theme['c-primary-background-active'],
                    }}
                    onPress={() => {
                      if (isRoamCard(card.id)) handleRoamPress()
                      else setNavActiveId(card.id)
                    }}
                    onLongPress={isRoamCard(card.id) ? () => { roamDialogRef.current?.setVisible(true) } : undefined}
                    activeOpacity={0.7}
                  >
                    <Icon name={card.icon} size={iconSize} color={theme['c-primary']} />
                    <Text style={{ ...styles.label, fontSize, color: theme['c-font'] }}>{global.i18n.t(card.labelKey)}</Text>
                  </TouchableOpacity>
                ))
              }
            </View>
          ))
        }
      </View>
    )
  }

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

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {renderBody()}
      {/* 【v42】歌曲漫游：长按卡片弹出档位选择；【v44】大模块化横向布局方便车机点选 */}
      <Dialog ref={roamDialogRef} title={t('roam_title')} width={430}>
        <View style={styles.roamBox}>
          <Text style={styles.roamDesc} size={12} color={theme['c-font-label']}>{t('roam_mode_tip')}</Text>
          <View style={styles.roamModeRow}>
            {(['conservative', 'balanced', 'explorative'] as const).map(mode => {
              const active = roamMode == mode
              return (
                <TouchableOpacity
                  key={mode}
                  style={{
                    ...styles.roamModeBtn,
                    backgroundColor: active ? theme['c-primary-background-active'] : theme['c-button-background'],
                    borderColor: active ? theme['c-primary'] : 'transparent',
                  }}
                  onPress={() => { handleModeSelect(mode) }}
                >
                  <Text style={{ ...styles.roamModeTitle, color: active ? theme['c-primary-font'] : theme['c-button-font'] }}>
                    {roamModeTitle(mode)}{active ? ` · ${t('roam_mode_current')}` : ''}
                  </Text>
                  <Text size={12} color={active ? theme['c-primary-font'] : theme['c-font-label']}>{roamModeDesc(mode)}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <View style={styles.roamActionRow}>
            <TouchableOpacity
              style={{ ...styles.roamActionBtn, backgroundColor: theme['c-button-background'] }}
              onPress={() => { void nextRoamBatch() }}
            >
              <Text style={{ ...styles.roamActionText, color: theme['c-button-font'] }}>{t('roam_next_batch')}</Text>
            </TouchableOpacity>
            {
              getRoamState().active ? (
                <TouchableOpacity
                  style={{ ...styles.roamActionBtn, backgroundColor: theme['c-button-background'] }}
                  onPress={handleEndRoam}
                >
                  <Text style={{ ...styles.roamActionText, color: theme['c-button-font'] }}>{t('roam_end')}</Text>
                </TouchableOpacity>
              ) : null
            }
          </View>
        </View>
      </Dialog>
    </View>
  )
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PAD,
    gap: GAP,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
  roamBox: {
    paddingTop: 6,
    gap: 12,
  },
  roamDesc: {
    lineHeight: 18,
  },
  roamModeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roamModeBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
  },
  roamModeTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  roamActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roamActionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roamActionText: {
    fontSize: 15,
  },
})
