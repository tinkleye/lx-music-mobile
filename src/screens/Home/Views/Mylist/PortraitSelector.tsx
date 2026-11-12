import { useState } from 'react'
import { View, TouchableOpacity, Modal, FlatList } from 'react-native'

import { useMyList, useActiveListId } from '@/store/list/hook'
import { setActiveList } from '@/core/list'
import IconIon from '@/components/common/IconIon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import MyList from './MyList'

// 【v40】车机模式竖屏的「我的列表」：屏幕窄，左右两栏挤不下，
// 改为单栏 —— 顶部一条歌单下拉选择器（点开弹出全部内置/自建列表，
// 当前项高亮），下方是当前列表的歌曲（正常上下滚动）。
// 「管理列表」入口在下拉面板底部（新建/重命名/排序/导入导出等全功能），
// 打开全屏管理页（复用车机模式左栏的 MyList 组件）。

export default () => {
  const theme = useTheme()
  const allList = useMyList()
  const activeListId = useActiveListId()
  const [showPicker, setShowPicker] = useState(false)
  const [showManage, setShowManage] = useState(false)

  const activeList = allList.find(l => l.id === activeListId) ?? allList[0]

  const handleSelect = (item: LX.List.MyListInfo) => {
    setShowPicker(false)
    if (item.id != activeListId) {
      requestAnimationFrame(() => {
        setActiveList(item.id)
      })
    }
  }

  return (
    <>
      {/* 顶栏：当前列表名 + 下拉箭头，点开选择面板 */}
      <TouchableOpacity
        style={{ ...styles.selector, backgroundColor: theme['c-content-background'] }}
        onPress={() => { setShowPicker(true) }}
        activeOpacity={0.7}
      >
        <Text numberOfLines={1} style={styles.selectorName}>{activeList?.name}</Text>
        <IconIon name="chevron-down" size={16} color={theme['c-350']} />
      </TouchableOpacity>

      {/* 歌单选择面板 */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => { setShowPicker(false) }}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { setShowPicker(false) }}>
          <TouchableOpacity activeOpacity={1} style={{ ...styles.panel, backgroundColor: theme['c-content-background'] }}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{global.i18n.t('mylist_select')}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => { setShowPicker(false) }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <IconIon name="close" size={20} color={theme['c-350']} />
              </TouchableOpacity>
            </View>
            <FlatList
              style={styles.list}
              data={allList}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const active = item.id == activeListId
                return (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => { handleSelect(item) }}
                    activeOpacity={0.7}
                  >
                    <IconIon
                      name={active ? 'checkmark' : 'musical-notes'}
                      size={16}
                      color={active ? theme['c-primary'] : theme['c-350']} />
                    <Text numberOfLines={1} style={{ ...styles.listItemName, color: active ? theme['c-primary'] : theme['c-font'] }}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )
              }}
            />
            <TouchableOpacity
              style={{ ...styles.manageBtn, borderTopColor: theme['c-border'] }}
              onPress={() => {
                setShowPicker(false)
                setShowManage(true)
              }}
              activeOpacity={0.7}
            >
              <IconIon name="settings-outline" size={16} color={theme['c-primary']} />
              <Text style={{ ...styles.manageBtnText, color: theme['c-primary'] }}>
                {global.i18n.t('mylist_manage')}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 列表管理（全功能：新建/重命名/删除/排序/导入导出/查重） */}
      <Modal visible={showManage} animationType="slide" onRequestClose={() => { setShowManage(false) }}>
        <View style={{ ...styles.manageContainer, backgroundColor: theme['c-main-background'] }}>
          <View style={{ ...styles.manageHeader, borderBottomColor: theme['c-border'] }}>
            <Text style={styles.manageTitle}>{global.i18n.t('mylist_manage')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setShowManage(false) }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <IconIon name="close" size={22} color={theme['c-font']} />
            </TouchableOpacity>
          </View>
          <View style={styles.manageBody}>
            <MyList alwaysVisible />
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = createStyle({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 14,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  selectorName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  panel: {
    borderRadius: 12,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    flexGrow: 0,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 16,
  },
  listItemName: {
    flex: 1,
    fontSize: 15,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderTopWidth: 1,
  },
  manageBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  manageContainer: {
    flex: 1,
  },
  manageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  manageTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  manageBody: {
    flex: 1,
    paddingHorizontal: 12,
  },
})
