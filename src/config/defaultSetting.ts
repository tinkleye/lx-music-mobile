const defaultSetting: LX.AppSetting = {
  version: '2.1',
  // 【v42】跟随系统亮、暗模式切换主题：新安装默认开启
  'common.isAutoTheme': true,
  'common.langId': null,
  'common.apiSource': '',
  'common.sourceNameType': 'alias',
  'common.shareType': 'system',
  'common.isAgreePact': false,
  'common.autoHidePlayBar': true,
  'common.drawerLayoutPosition': 'left',
  'common.homePageScroll': true,
  'common.allowProgressBarSeek': true,
  'common.showBackBtn': false,
  'common.showExitBtn': true,
  'common.useSystemFileSelector': true,
  'common.alwaysKeepStatusbarHeight': false,
  // 【改造】启动时自动检查自定义源更新
  'common.autoUpdateUserApi': true,

  'player.startupAutoPlay': false,
  'player.startupPushPlayDetailScreen': false,
  'player.togglePlayMethod': 'listLoop',
  'player.playQuality': '128k',
  'player.isSavePlayTime': false,
  'player.volume': 1,
  'player.playbackRate': 1,
  'player.cacheSize': '1024',
  'player.timeoutExit': '',
  'player.timeoutExitPlayed': true,
  'player.isAutoCleanPlayedList': false,
  'player.isHandleAudioFocus': true,
  'player.isEnableAudioOffload': false,
  'player.isShowLyricTranslation': false,
  'player.isShowLyricRoma': false,
  'player.isShowNotificationImage': true,
  'player.isS2t': false,
  'player.isShowBluetoothLyric': false,
  'player.isShowBluetoothFullLyric': false,

  // 'playDetail.isZoomActiveLrc': false,
  // 'playDetail.isShowLyricProgressSetting': false,
  'playDetail.style.align': 'left',
  'playDetail.vertical.style.lrcFontSize': 210,
  'playDetail.horizontal.style.lrcFontSize': 220,
  'playDetail.isShowLyricProgressSetting': false,

  'desktopLyric.enable': false,
  'desktopLyric.isLock': false,
  'desktopLyric.width': 100,
  'desktopLyric.maxLineNum': 5,
  'desktopLyric.isSingleLine': false,
  'desktopLyric.showToggleAnima': true,
  'desktopLyric.position.x': 0,
  'desktopLyric.position.y': 0,
  'desktopLyric.textPosition.x': 'left',
  'desktopLyric.textPosition.y': 'top',
  'desktopLyric.style.fontSize': 180,
  'desktopLyric.style.opacity': 100,
  'desktopLyric.style.lyricUnplayColor': 'rgba(255, 255, 255, 1)',
  'desktopLyric.style.lyricPlayedColor': 'rgba(7, 197, 86, 1)',
  'desktopLyric.style.lyricShadowColor': 'rgba(0, 0, 0, 0.6)',

  'search.isShowHotSearch': false,
  'search.isShowHistorySearch': false,

  'list.isClickPlayList': false,
  'list.isShowSource': true,
  'list.isShowAlbumName': false,
  'list.isShowInterval': true,
  'list.isSaveScrollLocation': true,
  'list.addMusicLocationType': 'top',
  // 【v42】打开歌单时自动起播：off / first / random（车机模式运行时按"随机"兜底）
  'list.isAutoPlayOnOpen': 'off',

  'download.fileName': '歌名 - 歌手',
  // 【v43】下载目录（空=自动）/ 默认音质（空=跟随播放音质）/ 内嵌标签 / 附加文件
  'download.dir': '',
  'download.quality': '',
  'download.isEmbedCover': false,
  'download.isEmbedLyric': false,
  'download.isSaveLrc': false,
  'download.isSaveCover': false,

  'sync.enable': false,

  // 'theme.id': 'blue_plus',
  'theme.id': 'black',
  'theme.lightId': 'green',
  'theme.darkId': 'black',
  // 【v42】隐藏黑色主题背景、动态背景：新安装默认开启
  'theme.hideBgDark': true,
  'theme.dynamicBg': true,
  'theme.fontShadow': false,

  // 【v42】下载外壳设置项
  'download.isAskQuality': false,
  'download.concurrency': 3,
  'download.isAutoToggleSource': true,

  // 【v42】歌曲漫游
  'roam.mode': 'balanced',
  'roam.excludedLists': [],
}


// 使用新年皮肤
if (new Date().getMonth() < 2) {
  defaultSetting['theme.id'] = 'happy_new_year'
  defaultSetting['desktopLyric.style.lyricPlayedColor'] = 'rgba(255, 18, 34, 1)'
}

export default defaultSetting
