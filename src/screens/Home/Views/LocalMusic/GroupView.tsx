import { useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

// 【v33】本地音乐分组视图：专辑 / 歌手 / 文件夹 三种分组方式。
// 数据源固定为本地音乐列表，点击歌曲按其在完整列表中的原始位置播放。
// 【v37】横屏翻页模式（paged=true）：分组+歌曲拍平成等高行，用 CarPagedList
// 左右翻页展示（行驶中不适合上下滑动）；竖屏保持原来的纵向 ScrollView + 展开/收起。
// 【v38】视觉统一：分组头显示分组图标（专辑=album 唱片 / 歌手=leaderboard / 文件夹=sd-card）
// 与「N 首」数量，去掉展开三角指示；歌曲行显示组内数字序号，
// 正在播放的那首序号变播放三角 + 主题色高亮（竖屏横屏一致）。
// 注意：createStyle 等工具函数必须显式导入（v31 崩溃教训）
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import CarPagedList from '@/components/common/CarPagedList'

export type GroupBy = 'album' | 'singer' | 'folder'

// 【v38】分组图标映射（自带图标字体；无话筒/纯文件夹图标，用语义近似图标代替）
// 注意用字面量类型（Icon 组件的 name 是图标名字面量联合类型，string 会在 tsc 报错）
type GroupIconName = 'album' | 'leaderboard' | 'sd-card'
const GROUP_ICONS: Record<GroupBy, GroupIconName> = {
  album: 'album',
  singer: 'leaderboard',
  folder: 'sd-card',
}

interface GroupItem {
  id: string
  label: string
  entries: { info: LX.Music.MusicInfo, index: number }[]
}

// 【v37】翻页模式统一行高（分组头与歌曲行同高，CarPagedList 按固定行高分页）
const PAGE_ROW_HEIGHT = 48

// 翻页模式下的拍平行：分组头 或 歌曲行
type FlatRow =
  | { key: string, kind: 'group', label: string, count: number, groupId: string }
  | { key: string, kind: 'song', name: string, singer: string, index: number, id: string, ordinal: number }

const getFilePath = (info: LX.Music.MusicInfo) => {
  return (info as LX.Music.MusicInfoLocal).meta?.filePath ?? ''
}

const dirNameOf = (path: string) => {
  const i = path.lastIndexOf('/')
  return i > 0 ? path.substring(0, i) : '/'
}

const baseNameOf = (path: string) => {
  const p = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path
  const i = p.lastIndexOf('/')
  return i >= 0 ? p.substring(i + 1) : p
}

export default ({ musics, groupBy, onPlay, paged = false, numColumns = 1 }: {
  musics: LX.Music.MusicInfo[]
  groupBy: GroupBy
  onPlay: (index: number) => void
  paged?: boolean
  numColumns?: number
}) => {
  const t = useI18n()
  const theme = useTheme()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // 【v38】当前播放中的歌曲（用于序号 → 播放三角的切换与高亮）
  const playingInfo = usePlayerMusicInfo()
  const groupIcon = GROUP_ICONS[groupBy]

  const groups = useMemo<GroupItem[]>(() => {
    const map = new Map<string, GroupItem>()
    const unknownAlbum = t('local_music_unknown_album')
    const unknownSinger = t('local_music_unknown_singer')

    musics.forEach((info, index) => {
      let id = ''
      let label = ''
      if (groupBy == 'album') {
        id = label = (info as LX.Music.MusicInfoLocal).meta?.albumName || unknownAlbum
      } else if (groupBy == 'singer') {
        id = label = info.singer || unknownSinger
      } else {
        const dir = dirNameOf(getFilePath(info) || info.id)
        id = dir
        label = baseNameOf(dir)
      }
      let group = map.get(id)
      if (!group) {
        group = { id, label, entries: [] }
        map.set(id, group)
      }
      group.entries.push({ info, index })
    })

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [musics, groupBy, t])

  // 【v37】翻页模式：把「分组头 + 展开后的歌曲」拍平成等高行数组，
  // 展开状态变化时重建（CarPagedList 会自动重新分页）
  const flatRows = useMemo<FlatRow[]>(() => {
    if (!paged) return []
    const rows: FlatRow[] = []
    for (const g of groups) {
      rows.push({ key: `g_${g.id}`, kind: 'group', label: g.label, count: g.entries.length, groupId: g.id })
      if (expandedId == g.id) {
        let ordinal = 0
        for (const e of g.entries) {
          ordinal++
          rows.push({ key: `s_${e.info.id}`, kind: 'song', name: e.info.name, singer: e.info.singer, index: e.index, id: e.info.id, ordinal })
        }
      }
    }
    return rows
  }, [paged, groups, expandedId])

  // 【v37】横屏翻页模式渲染
  if (paged) {
    return (
      <CarPagedList
        data={flatRows}
        itemHeight={PAGE_ROW_HEIGHT}
        numColumns={numColumns}
        keyExtractor={row => row.key}
        emptyComponent={<Text style={{ ...styles.empty, color: theme['c-font-label'] }}>{t('local_music_empty')}</Text>}
        renderItem={row => row.kind == 'group'
          ? (
              // 【v38】分组头：分组图标 + 名称 + 「N 首」，无展开三角
              <TouchableOpacity
                style={{ ...styles.pageRow, ...styles.pageGroupRow }}
                onPress={() => { setExpandedId(expandedId == row.groupId ? null : row.groupId) }}
                activeOpacity={0.7}>
                <Icon name={groupIcon} size={16} color={theme['c-font-label']} />
                <Text numberOfLines={1} style={{ ...styles.pageGroupName, color: theme['c-font'] }}>{row.label}</Text>
                <Text style={{ ...styles.pageCount, color: theme['c-font-label'] }}>{`${row.count} ${t('local_music_unit_songs')}`}</Text>
              </TouchableOpacity>
            )
          : (
              // 【v38】歌曲行：组内数字序号；正在播放的那首序号变播放三角 + 高亮
              (() => {
                const isPlaying = playingInfo?.id == row.id
                return (
                  <TouchableOpacity
                    style={{ ...styles.pageRow, ...styles.pageSongRow }}
                    onPress={() => { onPlay(row.index) }}
                    activeOpacity={0.7}>
                    {
                      isPlaying
                        ? <Icon name="play-outline" size={13} color={theme['c-primary']} />
                        : <Text style={{ ...styles.pageNum, color: theme['c-font-label'] }}>{row.ordinal}</Text>
                    }
                    <Text numberOfLines={1} style={{ ...styles.pageSongName, color: isPlaying ? theme['c-primary'] : theme['c-font'] }}>{row.name}</Text>
                    <Text numberOfLines={1} style={{ ...styles.pageSongSinger, color: theme['c-font-label'] }}>{row.singer}</Text>
                  </TouchableOpacity>
                )
              })()
            )}
      />
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {
        groups.map(group => {
          return (
            <View key={group.id} style={{ ...styles.groupBlock, borderColor: theme['c-border'] }}>
              {/* 【v38】分组头：分组图标 + 名称 + 「N 首」，无展开三角 */}
              <TouchableOpacity
                style={styles.groupRow}
                onPress={() => { setExpandedId(expandedId == group.id ? null : group.id) }}
                activeOpacity={0.7}
              >
                <Icon name={groupIcon} size={16} color={theme['c-font-label']} />
                <Text style={{ ...styles.groupName, color: theme['c-font'] }} numberOfLines={1}>{group.label}</Text>
                <Text style={{ ...styles.groupCount, color: theme['c-font-label'] }}>{`${group.entries.length} ${t('local_music_unit_songs')}`}</Text>
              </TouchableOpacity>
              {
                expandedId == group.id
                  ? group.entries.map(({ info, index }, i) => {
                      // 【v38】歌曲行：组内数字序号；正在播放的那首序号变播放三角 + 高亮
                      const isPlaying = playingInfo?.id == info.id
                      return (
                        <TouchableOpacity
                          key={info.id}
                          style={styles.songRow}
                          onPress={() => { onPlay(index) }}
                          activeOpacity={0.7}
                        >
                          {
                            isPlaying
                              ? <Icon name="play-outline" size={13} color={theme['c-primary']} />
                              : <Text style={{ ...styles.songOrdinal, color: theme['c-font-label'] }}>{i + 1}</Text>
                          }
                          <View style={styles.songInfo}>
                            <Text style={{ ...styles.songName, color: isPlaying ? theme['c-primary'] : theme['c-font'] }} numberOfLines={1}>{info.name}</Text>
                            <Text style={{ ...styles.songSinger, color: theme['c-font-label'] }} numberOfLines={1}>{info.singer}</Text>
                          </View>
                        </TouchableOpacity>
                      )
                    })
                  : null
              }
            </View>
          )
        })
      }
      {
        groups.length == 0
          ? <Text style={{ ...styles.empty, color: theme['c-font-label'] }}>{t('local_music_empty')}</Text>
          : null
      }
    </ScrollView>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  groupBlock: {
    borderBottomWidth: BorderWidths.normal,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 10,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  groupCount: {
    fontSize: 12,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 36,
    paddingRight: 15,
    paddingTop: 9,
    paddingBottom: 9,
    gap: 10,
  },
  // 【v38】歌曲行序号（与播放三角占同宽，切换时行内容不跳动）
  songOrdinal: {
    width: 16,
    textAlign: 'center',
    fontSize: 11,
  },
  songInfo: {
    flex: 1,
  },
  songName: {
    fontSize: 13,
  },
  songSinger: {
    fontSize: 11,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    paddingTop: 40,
    fontSize: 13,
  },
  // 【v37】翻页模式的等高行（行高 PAGE_ROW_HEIGHT，由 CarPagedList 的格子撑满）
  pageRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  pageGroupRow: {
    paddingLeft: 10,
  },
  pageSongRow: {
    paddingLeft: 28,
  },
  pageGroupName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  pageSongName: {
    fontSize: 13,
    flex: 1.2,
  },
  pageSongSinger: {
    fontSize: 11,
    flex: 1,
    textAlign: 'right',
  },
  pageCount: {
    fontSize: 12,
  },
  // 【v38】翻页模式歌曲行序号（与播放三角占同宽）
  pageNum: {
    width: 16,
    textAlign: 'center',
    fontSize: 11,
  },
})
