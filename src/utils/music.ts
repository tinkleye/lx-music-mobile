import { existsFile } from './fs'


export const getLocalFilePath = async(musicInfo: LX.Music.MusicInfoLocal): Promise<string> => {
  if (await existsFile(musicInfo.meta.filePath)) return musicInfo.meta.filePath
  // 直接从应用外 intent 调用打开的文件，ogg等类型无法判断文件是否存在，但这类文件路径为纯数字
  return /\/\d+$/.test(musicInfo.meta.filePath) ? musicInfo.meta.filePath : ''
}

/**
 * 【车机改造】净化歌词：剥掉全部时间戳/元数据标签/逐字标签，只留纯文本。
 * 车机媒体卡片/蓝牙仪表盘会原样显示 LYRICS 元数据，发送前必须净化。
 */
export const sanitizeLyricForMediaSession = (lyric: string): string => {
  return lyric
    .split(/\r\n|\n|\r/)
    .map(line => line
      .replace(/\[[^\[\]]*\]/g, '') // [mm:ss.xx] 时间戳与 [ti:] 等元数据标签
      .replace(/<[^<>]*>/g, '') // 逐字时间标签
      .trim())
    .filter(Boolean)
    .join('\n')
}
