import type { I18n } from '@/lang/i18n'

declare global {
  namespace LX {
    type AddMusicLocationType = 'top' | 'bottom'

    interface AppSetting {
      version: string
      /**
       * 是否跟随系统切换亮暗主题
       */
      'common.isAutoTheme': boolean

      /**
       * 语言id
       */
      'common.langId': I18n['locale'] | null

      /**
       * api id
       */
      'common.apiSource': string

      /**
       * 音源名称类型，原名、别名
       */
      'common.sourceNameType': 'alias' | 'real'

      /**
       * 歌曲分享方式
       */
      'common.shareType': 'system' | 'clipboard'

      /**
       * 是否同意软件协议
       */
      'common.isAgreePact': boolean

      /**
       * 是否在键盘弹出时隐藏播放栏
       */
      'common.autoHidePlayBar': boolean

      /**
       * 抽屉组件弹出方向
       */
      'common.drawerLayoutPosition': 'left' | 'right'

      /**
       * 启用首页滑动
       */
      'common.homePageScroll': boolean

      /**
       * 允许通过底栏进度条调整进度
       */
      'common.allowProgressBarSeek': boolean

      /**
       * 是否显示返回按钮
       */
      'common.showBackBtn': boolean

      /**
       * 是否显示退出按钮
       */
      'common.showExitBtn': boolean

      /**
       * 使用系统文件选择器
       */
      'common.useSystemFileSelector': boolean

      /**
       * 总是保留状态栏高度
       */
      'common.alwaysKeepStatusbarHeight': boolean

      /**
       * 【改造】启动时自动检查自定义源更新
       */
      'common.autoUpdateUserApi': boolean

      /**
       * 主题id
       */
      'theme.id': string

      /**
       * 亮色主题id
       */
      'theme.lightId': string

      /**
       * 暗色主题id
       */
      'theme.darkId': string

      /**
       * 隐藏黑色主题背景
       */
      'theme.hideBgDark': boolean

      /**
       * 动态背景
       */
      'theme.dynamicBg': boolean

      /**
       * 字体阴影
       */
      'theme.fontShadow': boolean

      /**
       * 启动时自动播放歌曲
       */
      'player.startupAutoPlay': boolean

      /**
       * 启动后打开歌曲详细界面
       */
      'player.startupPushPlayDetailScreen': boolean

      /**
       * 切歌模式
       */
      'player.togglePlayMethod': 'listLoop' | 'random' | 'list' | 'singleLoop' | 'none'

      /**
       * 优先播放的音质
       */
      'player.playQuality': LX.Quality

      /**
       * 启动软件时是否恢复上次播放进度
       */
      'player.isSavePlayTime': boolean

      /**
       * 音量大小
       */
      'player.volume': number

      /**
       * 播放速率
       */
      'player.playbackRate': number

      /**
       * 缓存大小设置 unit MiB
       */
      'player.cacheSize': string

      /**
       * 定时暂停播放-倒计时时间
       */
      'player.timeoutExit': string

      /**
       * 定时暂停播放-是否等待歌曲播放完毕再暂停
       */
      'player.timeoutExitPlayed': boolean

      /**
       * 点击相同列表内的歌曲切歌时是否清空已播放列表（随机模式下列表内所有歌曲会重新参与随机）
       */
      'player.isAutoCleanPlayedList': boolean

      /**
       * 其他应用播放声音时是否自动暂停
       */
      'player.isHandleAudioFocus': boolean

      /**
       * 是否启用音频卸载功能（这可以节省耗电量，没有播放异常问题不建议关闭）
       */
      'player.isEnableAudioOffload': boolean

      /**
       * 是否显示歌词翻译
       */
      'player.isShowLyricTranslation': boolean

      /**
       * 是否显示歌词罗马音
       */
      'player.isShowLyricRoma': boolean

      /**
       * 是否在通知栏显示歌曲图片
       */
      'player.isShowNotificationImage': boolean

      /**
       * 是否将歌词从简体转换为繁体
       */
      'player.isS2t': boolean

      /**
       * 是否启用蓝牙歌词
       */
      'player.isShowBluetoothLyric': boolean

      /**
       * 是否启用蓝牙完整歌词
       */
      'player.isShowBluetoothFullLyric': boolean

      /**
       * 播放详情页-是否缩放当前播放的歌词行
       */
      // 'playDetail.isZoomActiveLrc': boolean

      /**
       * 播放详情页-是否允许通过歌词调整播放进度
       */
      // 'playDetail.isShowLyricProgressSetting': boolean

      /**
       * 播放详情页-歌词对齐方式
       */
      'playDetail.style.align': 'center' | 'left' | 'right'

      /**
       * 竖屏歌词字体大小
       */
      'playDetail.vertical.style.lrcFontSize': number

      /**
       * 横屏歌词字体大小
       */
      'playDetail.horizontal.style.lrcFontSize': number

      /**
       * 播放详情页-是否允许通过歌词调整播放进度
       */
      'playDetail.isShowLyricProgressSetting': boolean

      /**
       * 是否启用桌面歌词
       */
      'desktopLyric.enable': boolean

      /**
       * 是否锁定桌面歌词
       */
      'desktopLyric.isLock': boolean

      /**
       * 桌面歌词窗口宽度
       */
      'desktopLyric.width': number

      /**
       * 桌面歌词最大行数
       */
      'desktopLyric.maxLineNum': number

      /**
       * 桌面歌词是否使用单行显示
       */
      'desktopLyric.isSingleLine': boolean

      /**
       * 桌面歌词是否启用歌词切换动画
       */
      'desktopLyric.showToggleAnima': boolean

      /**
       * 桌面歌词窗口x坐标
       */
      'desktopLyric.position.x': number

      /**
       * 桌面歌词窗口y坐标
       */
      'desktopLyric.position.y': number

      /**
       * 歌词水平对齐方式
       */
      'desktopLyric.textPosition.x': 'left' | 'center' | 'right'

      /**
       * 歌词垂直对齐方式
       */
      'desktopLyric.textPosition.y': 'top' | 'center' | 'bottom'

      /**
       * 桌面歌词字体大小
       */
      'desktopLyric.style.fontSize': number

      /**
       * 桌面歌词字体透明度
       */
      'desktopLyric.style.opacity': number

      /**
       * 桌面歌词未播放字体颜色
       */
      'desktopLyric.style.lyricUnplayColor': string

      /**
        * 桌面歌词已播放字体颜色
        */
      'desktopLyric.style.lyricPlayedColor': string

      /**
        * 桌面歌词字体阴影颜色
        */
      'desktopLyric.style.lyricShadowColor': string

      /**
       * 是否显示热门搜索
       */
      'search.isShowHotSearch': boolean

      /**
       * 是否显示搜索历史
       */
      'search.isShowHistorySearch': boolean

      /**
       * 是否启用双击列表里的歌曲时自动切换到当前列表播放（仅对歌单、排行榜有效）
       */
      'list.isClickPlayList': boolean

      /**
       * 是否显示歌曲来源（仅对我的列表有效）
       */
      'list.isShowSource': boolean

      /**
       * 是否显示歌曲专辑名
       */
      'list.isShowAlbumName': boolean

      /**
       * 是否显示歌曲时长
       */
      'list.isShowInterval': boolean

      /**
       * 是否自动恢复列表滚动位置（仅对我的列表有效）
       */
      'list.isSaveScrollLocation': boolean

      /**
       * 添加歌曲到我的列表时的方式
       */
      'list.addMusicLocationType': AddMusicLocationType

      /**
       * 文件命名方式
       */
      'download.fileName': '歌名 - 歌手' | '歌手 - 歌名' | '歌名'

      /**
       * 【v43】自定义下载目录（绝对路径，空字符串 = 自动选择公共目录）
       */
      'download.dir': string

      /**
       * 【v43】默认下载音质（空字符串 = 跟随播放音质自动选择）
       */
      'download.quality': LX.Quality | ''

      /**
       * 【v43】下载后内嵌封面到音频文件标签
       */
      'download.isEmbedCover': boolean

      /**
       * 【v43】下载后内嵌歌词到音频文件标签
       */
      'download.isEmbedLyric': boolean

      /**
       * 【v43】下载后另存 .lrc 歌词文件
       */
      'download.isSaveLrc': boolean

      /**
       * 【v43】下载后另存封面图片文件
       */
      'download.isSaveCover': boolean

      /**
       * 【v42】下载前总是询问音质
       */
      'download.isAskQuality': boolean

      /**
       * 【v42】下载并发数（1~6）
       */
      'download.concurrency': number

      /**
       * 【v42】下载取不到目标音质时自动换源/降级
       */
      'download.isAutoToggleSource': boolean

      /**
       * 【v42】打开歌单时自动起播：off 不自动 / first 第一首 / random 随机一首
       */
      'list.isAutoPlayOnOpen': 'off' | 'first' | 'random'

      /**
       * 【v42】歌曲漫游风格浓度：conservative 保守 / balanced 均衡 / explorative 探索
       */
      'roam.mode': 'conservative' | 'balanced' | 'explorative'

      /**
       * 【v42】不参与漫游的歌单 id 列表
       */
      'roam.excludedLists': string[]

      /**
       * 是否启用同步
       */
      'sync.enable': boolean
    }
  }
}

