import { useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

// 【v33】本地音乐分组视图：专辑 / 歌手 / 文件夹 三种分组方式。
// 数据源固定为本地音乐列表，点击歌曲按其在完整列表中的原始位置播放。
// 注意：createStyle 等工具函数必须显式导入（v31 崩溃教训）
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'

export type GroupBy = 'album' | 'singer' | 'folder'

interface GroupItem {
  id: string
  label: string
  entries: { info: LX.Music.MusicInfo, index: number }[]
}

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

export default ({ musics, groupBy, onPlay }: {
  musics: LX.Music.MusicInfo[]
  groupBy: GroupBy
  onPlay: (index: number) => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {
        groups.map(group => {
          const expanded = expandedId == group.id
          return (
            <View key={group.id} style={{ ...styles.groupBlock, borderColor: theme['c-border'] }}>
              <TouchableOpacity
                style={styles.groupRow}
                onPress={() => { setExpandedId(expanded ? null : group.id) }}
                activeOpacity={0.7}
              >
                <Icon
                  name={expanded ? 'single-loop' : 'play-outline'}
                  size={14}
                  color={theme['c-primary']}
                />
                <Text style={{ ...styles.groupName, color: theme['c-font'] }} numberOfLines={1}>{group.label}</Text>
                <Text style={{ ...styles.groupCount, color: theme['c-font-label'] }}>{group.entries.length}</Text>
              </TouchableOpacity>
              {
                expanded
                  ? group.entries.map(({ info, index }) => (
                      <TouchableOpacity
                        key={info.id}
                        style={styles.songRow}
                        onPress={() => { onPlay(index) }}
                        activeOpacity={0.7}
                      >
                        <Icon name="play" size={14} color={theme['c-font-label']} />
                        <View style={styles.songInfo}>
                          <Text style={{ ...styles.songName, color: theme['c-font'] }} numberOfLines={1}>{info.name}</Text>
                          <Text style={{ ...styles.songSinger, color: theme['c-font-label'] }} numberOfLines={1}>{info.singer}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
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
    paddingLeft: 32,
    paddingRight: 15,
    paddingTop: 9,
    paddingBottom: 9,
    gap: 10,
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
})
