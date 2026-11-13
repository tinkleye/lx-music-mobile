import { memo } from 'react'

import { View } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'

export default memo(({ title, children, compact = false }: {
  title: string
  children?: React.ReactNode | React.ReactNode[]
  /** 【v46】紧凑模式：纯分组标题（无右侧内容）时收紧标题与子选项的间距 */
  compact?: boolean
}) => {
  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      <Text style={compact ? styles.titleCompact : styles.title}>{title}</Text>
      {children}
    </View>
  )
})


const styles = createStyle({
  container: {
    paddingLeft: 25,
    marginBottom: 18,
  },
  containerCompact: {
    paddingLeft: 25,
    marginBottom: 10,
  },
  title: {
    marginLeft: -10,
    marginBottom: 10,
    // lineHeight: 16,
  },
  titleCompact: {
    marginLeft: -10,
    marginBottom: 2,
  },
})
