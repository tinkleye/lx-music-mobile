import { playList } from '@/core/player/player'
import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent, type FlatListProps } from 'react-native'

import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import { getListPosition, getListPrevSelectId, saveListPosition } from '@/utils/data'
// import { useMusicList } from '@/store/list/hook'
import { getListMusics, setActiveList } from '@/core/list'
import ListItem, { ITEM_HEIGHT } from './ListItem'
import { createStyle, getRowInfo } from '@/utils/tools'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import type { Position } from './ListMenu'
import type { SelectMode } from './MultipleModeBar'
import { useActiveListId } from '@/store/list/hook'
import { useSettingValue } from '@/store/setting/hook'
import CarPagedList, { type CarPagedListType } from '@/components/common/CarPagedList'
import { isCarModeEnabled } from '@/config/carMode'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'

// 【改造】车机模式下歌曲列表改成左右翻页（一屏一页，滑动翻页）
const carMode = isCarModeEnabled()

type FlatListType = FlatListProps<LX.Music.MusicInfo>

export interface ListProps {
  onShowMenu: (musicInfo: LX.Music.MusicInfo, index: number, position: Position) => void
  onMuiltSelectMode: () => void
  onSelectAll: (isAll: boolean) => void
  // 【车机改造】固定列表 ID：传入后本组件只显示该列表（如本地音乐），不再跟随全局 activeListId
  listId?: string
}
export interface ListType {
  setIsMultiSelectMode: (isMultiSelectMode: boolean) => void
  setSelectMode: (mode: SelectMode) => void
  selectAll: (isAll: boolean) => void
  getSelectedList: () => LX.List.ListMusics
  scrollToInfo: (info: LX.Music.MusicInfo) => void
  scrollToTop: () => void
}

const usePlayIndex = (listId?: string) => {
  const activeListId = useActiveListId()
  const playMusicInfo = usePlayMusicInfo()
  const playInfo = usePlayInfo()

  const playIndex = useMemo(() => {
    return playMusicInfo.listId == (listId ?? activeListId) ? playInfo.playIndex : -1
  }, [listId, activeListId, playInfo.playIndex, playMusicInfo.listId])

  return playIndex
}


const List = forwardRef<ListType, ListProps>(({ onShowMenu, onMuiltSelectMode, onSelectAll, listId }, ref) => {
  // const t = useI18n()
  const t = useI18n()
  const theme = useTheme()
  const flatListRef = useRef<FlatList>(null)
  const pagedRef = useRef<CarPagedListType>(null)
  const [currentList, setList] = useState<LX.List.ListMusics>([])
  const listFirstScrollRef = useRef(false)
  const isMultiSelectModeRef = useRef(false)
  const selectModeRef = useRef<SelectMode>('single')
  const prevSelectIndexRef = useRef(-1)
  const [selectedList, setSelectedList] = useState<LX.List.ListMusics>([])
  const selectedListRef = useRef<LX.List.ListMusics>([])
  const currentListIdRef = useRef('')
  const propsListIdRef = useRef(listId) // 【车机改造】固定列表 ID 快照（组件不重挂载时保持不变）
  const waitJumpListPositionRef = useRef(false)
  const rowInfo = useRef(getRowInfo())
  const isShowAlbumName = useSettingValue('list.isShowAlbumName')
  const isShowInterval = useSettingValue('list.isShowInterval')
  // console.log('render music list')

  useImperativeHandle(ref, () => ({
    setIsMultiSelectMode(isMultiSelectMode) {
      isMultiSelectModeRef.current = isMultiSelectMode
      if (!isMultiSelectMode) {
        prevSelectIndexRef.current = -1
        handleUpdateSelectedList([])
      }
    },
    setSelectMode(mode) {
      selectModeRef.current = mode
    },
    selectAll(isAll) {
      let list: LX.List.ListMusics
      if (isAll) {
        list = [...currentList]
      } else {
        list = []
      }
      selectedListRef.current = list
      setSelectedList(list)
    },
    getSelectedList() {
      return selectedListRef.current
    },
    scrollToInfo(info) {
      void getListMusics(listId ?? listState.activeListId).then((list) => {
        const index = list.findIndex(m => m.id == info.id)
        if (index < 0) return
        if (carMode) {
          pagedRef.current?.scrollToIndex(index, true)
          return
        }
        flatListRef.current?.scrollToIndex({ index: Math.floor(index / (rowInfo.current.rowNum ?? 1)), viewPosition: 0.3, animated: true })
      })
    },
    scrollToTop() {
      if (carMode) {
        pagedRef.current?.scrollToPage(0, true)
        return
      }
      flatListRef.current?.scrollToOffset({
        offset: 0,
        animated: true,
      })
    },
  }))

  useEffect(() => {
    let isUpdateingList = true
    const updateList = (id: string) => {
      if (currentListIdRef.current == id) return
      isUpdateingList = true
      setList([])
      currentListIdRef.current = id
      void Promise.all([getListMusics(id), getListPosition(id)]).then(([list, position]) => {
        requestAnimationFrame(() => {
          if (currentListIdRef.current != id) return
          selectedListRef.current = []
          setSelectedList([])
          setList([...list])
          requestAnimationFrame(() => {
            isUpdateingList = false
            listFirstScrollRef.current = true
            if (waitJumpListPositionRef.current) {
              waitJumpListPositionRef.current = false
              if (playerState.playMusicInfo.listId == id && playerState.playInfo.playIndex > -1) {
                if (carMode) {
                  pagedRef.current?.scrollToIndex(playerState.playInfo.playIndex, false)
                  return
                }
                try {
                  flatListRef.current?.scrollToIndex({ index: Math.floor(playerState.playInfo.playIndex / (rowInfo.current.rowNum ?? 1)), viewPosition: 0.3, animated: false })
                  return
                } catch {}
              }
            }
            if (carMode) {
              // 翻页模式没有纵向滚动位置的概念，切列表时直接回到第一页
              pagedRef.current?.scrollToPage(0, false)
              return
            }
            flatListRef.current?.scrollToOffset({ offset: position, animated: false })
          })
        })
      })
    }
    const handleChange = (ids: string[]) => {
      const id = listId ?? listState.activeListId
      if (!ids.includes(id)) return
      void getListMusics(id).then((list) => {
        if (currentListIdRef.current != id) return
        selectedListRef.current = []
        setSelectedList([])
        setList([...list])
      })
    }

    const handleJumpPosition = () => {
      requestAnimationFrame(() => {
        const listId = playerState.playMusicInfo.listId
        if (!listId) return
        // 【车机改造】固定列表模式下：只滚动到本列表内正在播放的歌曲，绝不切换全局激活列表
        if (typeof propsListIdRef.current == 'string') {
          if (listId == propsListIdRef.current && playerState.playInfo.playIndex > -1) {
            if (carMode) {
              pagedRef.current?.scrollToIndex(playerState.playInfo.playIndex, true)
              return
            }
            try {
              flatListRef.current?.scrollToIndex({ index: Math.floor(playerState.playInfo.playIndex / (rowInfo.current.rowNum ?? 1)), viewPosition: 0.3, animated: true })
            } catch {}
          }
          return
        }
        if (listId != listState.activeListId) {
          setActiveList(listId)
          if (currentListIdRef.current != listId) waitJumpListPositionRef.current = true
        } else if (playerState.playInfo.playIndex > -1) {
          if (isUpdateingList) waitJumpListPositionRef.current = true
          else {
            if (carMode) {
              pagedRef.current?.scrollToIndex(playerState.playInfo.playIndex, true)
              return
            }
            try {
              flatListRef.current?.scrollToIndex({ index: Math.floor(playerState.playInfo.playIndex / (rowInfo.current.rowNum ?? 1)), viewPosition: 0.3, animated: true })
            } catch {}
          }
        }
      })
    }
    // 【车机改造】固定列表模式：直接加载指定列表，不走「恢复上次选中列表」的流程
    if (typeof propsListIdRef.current == 'string') {
      updateList(propsListIdRef.current)
    } else if (global.lx.jumpMyListPosition) {
      global.lx.jumpMyListPosition = false
      if (playerState.playMusicInfo.listId) {
        waitJumpListPositionRef.current = true
        updateList(playerState.playMusicInfo.listId)
      } else void getListPrevSelectId().then(updateList)
    } else void getListPrevSelectId().then(updateList)

    // 固定列表模式不订阅 mylistToggled（全局激活列表变化与本地音乐无关）
    if (typeof propsListIdRef.current != 'string') {
      global.state_event.on('mylistToggled', updateList)
    }
    global.app_event.on('myListMusicUpdate', handleChange)
    global.app_event.on('jumpListPosition', handleJumpPosition)

    return () => {
      if (typeof propsListIdRef.current != 'string') {
        global.state_event.off('mylistToggled', updateList)
      }
      global.app_event.off('myListMusicUpdate', handleChange)
      global.app_event.off('jumpListPosition', handleJumpPosition)
    }
  }, [])

  const activeIndex = usePlayIndex(listId)
  const handlePlay = (index: number) => {
    void playList(listId ?? listState.activeListId, index)
  }

  const handleUpdateSelectedList = (newList: LX.List.ListMusics) => {
    if (selectedListRef.current.length && newList.length == currentList.length) onSelectAll(true)
    else if (selectedListRef.current.length == currentList.length) onSelectAll(false)
    selectedListRef.current = newList
    setSelectedList(newList)
  }
  const handleSelect = (item: LX.Music.MusicInfo, pressIndex: number) => {
    let newList: LX.List.ListMusics
    if (selectModeRef.current == 'single') {
      prevSelectIndexRef.current = pressIndex
      const index = selectedListRef.current.indexOf(item)
      if (index < 0) {
        newList = [...selectedListRef.current, item]
      } else {
        newList = [...selectedListRef.current]
        newList.splice(index, 1)
      }
    } else {
      if (selectedListRef.current.length) {
        const prevIndex = prevSelectIndexRef.current
        const currentIndex = pressIndex
        if (prevIndex == currentIndex) {
          newList = []
        } else if (currentIndex > prevIndex) {
          newList = currentList.slice(prevIndex, currentIndex + 1)
        } else {
          newList = currentList.slice(currentIndex, prevIndex + 1)
          newList.reverse()
        }
      } else {
        newList = [item]
        prevSelectIndexRef.current = pressIndex
      }
    }

    handleUpdateSelectedList(newList)
  }

  const handlePress = (item: LX.Music.MusicInfo, index: number) => {
    // console.log(global.lx.homePagerIdle)
    requestAnimationFrame(() => {
      // console.log(global.lx.homePagerIdle)
      if (!global.lx.homePagerIdle) return
      if (isMultiSelectModeRef.current) {
        handleSelect(item, index)
      } else {
        handlePlay(index)
      }
    })
  }

  const handleLongPress = (item: LX.Music.MusicInfo, index: number) => {
    if (isMultiSelectModeRef.current) return
    prevSelectIndexRef.current = index
    handleUpdateSelectedList([item])
    onMuiltSelectMode()
  }

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (listFirstScrollRef.current) {
      listFirstScrollRef.current = false
      return
    }
    void saveListPosition(listId ?? listState.activeListId, nativeEvent.contentOffset.y)
  }


  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <ListItem
      item={item}
      index={index}
      activeIndex={activeIndex}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onShowMenu={onShowMenu}
      selectedList={selectedList}
      rowInfo={rowInfo.current}
      isShowAlbumName={isShowAlbumName}
      isShowInterval={isShowInterval}
    />
  )
  const getkey: FlatListType['keyExtractor'] = item => item.id
  const getItemLayout: FlatListType['getItemLayout'] = (data, index) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  }

  // 【车机改造】分页模式：一屏一页完整显示，左右滑动翻页，不再上下滚动
  if (carMode) {
    return (
      <CarPagedList
        ref={pagedRef}
        data={currentList}
        itemHeight={ITEM_HEIGHT}
        numColumns={rowInfo.current.rowNum ?? 1}
        keyExtractor={item => item.id}
        emptyComponent={<Text size={13} color={theme['c-font-label']}>{t('car_paged_list_empty')}</Text>}
        renderItem={(item, index) => (
          <ListItem
            item={item}
            index={index}
            activeIndex={activeIndex}
            onPress={handlePress}
            onLongPress={handleLongPress}
            onShowMenu={onShowMenu}
            selectedList={selectedList}
            rowInfo={{ rowNum: undefined, rowWidth: '100%' }}
            isShowAlbumName={isShowAlbumName}
            isShowInterval={isShowInterval}
          />
        )}
      />
    )
  }

  return (
    <FlatList
      ref={flatListRef}
      onScroll={handleScroll}
      style={styles.list}
      data={currentList}
      maxToRenderPerBatch={4}
      numColumns={rowInfo.current.rowNum}
      horizontal={false}
      // updateCellsBatchingPeriod={80}
      windowSize={8}
      removeClippedSubviews={true}
      initialNumToRender={12}
      renderItem={renderItem}
      keyExtractor={getkey}
      extraData={activeIndex}
      getItemLayout={getItemLayout}
    />
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
    flexShrink: 1,
  },
})

export default List
