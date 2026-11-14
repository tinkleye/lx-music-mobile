package cn.toside.music.mobile.mediascanner;

import android.annotation.SuppressLint;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.storage.StorageManager;
import android.os.storage.StorageVolume;
import android.provider.MediaStore;

import androidx.core.content.ContextCompat;
import androidx.documentfile.provider.DocumentFile;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;

/**
 * 【车机改造】本地音乐扫描：基于系统 MediaStore 索引（零重复扫描开销），
 * 覆盖内置存储与所有已挂载的外置卷（U 盘）。
 * 【v32】智能过滤只呈现音乐：
 *   1. 排除系统标记的铃声/闹钟/通知音（IS_RINGTONE/IS_ALARM/IS_NOTIFICATION）
 *   2. 排除常见录音目录（录音机、通话录音、微信语音兜底）
 *   3. 排除时长 < 30 秒的短音频（录音、系统音效兜底）
 */
public class MediaScannerModule extends ReactContextBaseJavaModule {

  /** 时长阈值（秒）：低于此值视为录音/音效而非音乐 */
  private static final long MIN_DURATION_SECONDS = 30;

  /**
   * 录音目录黑名单：路径中包含这些片段（不区分大小写）的文件不收录。
   * 覆盖各厂商录音机、通话录音、微信语音等常见位置。
   */
  private static final String[] EXCLUDED_PATH_SEGMENTS = new String[]{
    "/recordings/", "/recordingsbackup/",
    "/record/", "/recorder/", "/voice_recorder/", "/voicerecorder/", "/voices/",
    "/sound_recorder/", "/sounds/", // 小米录音机 / 部分厂商录音与系统音效目录
    "/callrecord/", "/call_record/", "/callrecordings/", "/call/", "/calllog/",
    "/phoneRecord/", "/telephonerecord/",
    "/micromsg/", // 微信（语音、收到音频均在 micromsg 目录下）
  };

  private final ReactApplicationContext reactContext;

  /** 【v40】U盘插拔广播接收器（随 catalyst 实例生命周期注册/注销） */
  private BroadcastReceiver mountReceiver;

  MediaScannerModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "MediaScannerModule";
  }

  @Override
  public void initialize() {
    super.initialize();
    registerMountReceiver();
  }

  @Override
  public void onCatalystInstanceDestroy() {
    super.onCatalystInstanceDestroy();
    unregisterMountReceiver();
  }

  /**
   * 【v40】监听 U 盘/SD 卡挂载与移除系统广播（受保护广播，仅系统可发，EXPORTED 安全），
   * 向 JS 发送 localMediaMountChanged 事件 { mounted: boolean, path: string }，
   * 用于插入 U 盘自动增量扫描、拔出时提示。
   */
  private void registerMountReceiver() {
    try {
      if (mountReceiver != null) return;
      mountReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
          String action = intent.getAction();
          if (action == null) return;
          boolean mounted;
          switch (action) {
            case Intent.ACTION_MEDIA_MOUNTED:
              mounted = true;
              break;
            case Intent.ACTION_MEDIA_EJECT:
            case Intent.ACTION_MEDIA_UNMOUNTED:
            case Intent.ACTION_MEDIA_REMOVED:
              mounted = false;
              break;
            default:
              return;
          }
          String path = null;
          Uri data = intent.getData();
          if (data != null) path = data.getPath();
          if (mountReceiver == null) return;
          WritableMap params = Arguments.createMap();
          params.putBoolean("mounted", mounted);
          params.putString("path", path);
          try {
            reactContext
              .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
              .emit("localMediaMountChanged", params);
          } catch (Exception ignored) {
            // JS 侧未就绪时忽略，下次扫描会自动对齐
          }
        }
      };
      IntentFilter filter = new IntentFilter();
      filter.addAction(Intent.ACTION_MEDIA_MOUNTED);
      filter.addAction(Intent.ACTION_MEDIA_EJECT);
      filter.addAction(Intent.ACTION_MEDIA_UNMOUNTED);
      filter.addAction(Intent.ACTION_MEDIA_REMOVED);
      ContextCompat.registerReceiver(reactContext, mountReceiver, filter, ContextCompat.RECEIVER_EXPORTED);
    } catch (Throwable ignored) {
      // 广播注册失败只影响自动扫描，手动扫描不受影响
    }
  }

  private void unregisterMountReceiver() {
    try {
      if (mountReceiver != null) {
        reactContext.unregisterReceiver(mountReceiver);
        mountReceiver = null;
      }
    } catch (Throwable ignored) {
    }
  }

  /**
   * 扫描系统媒体库中的音频文件。
   * 返回: [{path, title, artist, album, duration, size, mime}]
   */
  @SuppressLint("Recycle")
  @ReactMethod
  public void scanAudio(final Promise promise) {
    try {
      WritableArray result = Arguments.createArray();
      Context context = reactContext;

      // Android 10+ 按 volume 分别查询（含 U 盘等外置卷）；旧版本直接查 EXTERNAL_CONTENT_URI
      List<Uri> uris = new java.util.ArrayList<>();
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        for (String volume : MediaStore.getExternalVolumeNames(context)) {
          uris.add(MediaStore.Audio.Media.getContentUri(volume));
        }
      } else {
        uris.add(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI);
      }

      String[] projection = new String[]{
        MediaStore.Audio.Media.DATA,
        MediaStore.Audio.Media.TITLE,
        MediaStore.Audio.Media.ARTIST,
        MediaStore.Audio.Media.ALBUM,
        MediaStore.Audio.Media.DURATION,
        MediaStore.Audio.Media.SIZE,
        MediaStore.Audio.Media.MIME_TYPE,
        // 【v32】系统音频分类标记：铃声/闹钟/通知/音乐
        MediaStore.Audio.Media.IS_RINGTONE,
        MediaStore.Audio.Media.IS_ALARM,
        MediaStore.Audio.Media.IS_NOTIFICATION,
        MediaStore.Audio.Media.IS_MUSIC,
      };

      for (Uri uri : uris) {
        Cursor cursor = null;
        try {
          cursor = context.getContentResolver().query(uri, projection, null, null,
            MediaStore.Audio.Media.ARTIST + " COLLATE NOCASE ASC, " + MediaStore.Audio.Media.ALBUM + " COLLATE NOCASE ASC, " + MediaStore.Audio.Media.TRACK + " ASC");
          if (cursor == null) continue;
          while (cursor.moveToNext()) {
            String path = cursor.getString(0);
            if (path == null || path.isEmpty()) continue;
            // 【v32】过滤 1：系统标记的铃声/闹钟/通知音
            if (cursor.getInt(7) == 1 || cursor.getInt(8) == 1 || cursor.getInt(9) == 1) continue;
            // 【v32】过滤 2：录音目录黑名单（大小写不敏感）
            String pathLower = '/' + path.toLowerCase() + '/';
            boolean excluded = false;
            for (String seg : EXCLUDED_PATH_SEGMENTS) {
              if (pathLower.contains(seg)) {
                excluded = true;
                break;
              }
            }
            if (excluded) continue;
            long duration = cursor.getLong(4);
            // 【v32】过滤 3：时长 < 30 秒的短音频（录音、系统音效兜底）；duration 未知(0)时放行由上层元数据兜底
            if (duration > 0 && duration < MIN_DURATION_SECONDS * 1000) continue;
            WritableMap map = Arguments.createMap();
            map.putString("path", path);
            map.putString("title", cursor.getString(1));
            String artist = cursor.getString(2);
            map.putString("artist", (artist == null || "<unknown>".equalsIgnoreCase(artist)) ? "" : artist);
            map.putString("album", cursor.getString(3) == null ? "" : cursor.getString(3));
            map.putDouble("duration", duration > 0 ? duration / 1000.0 : 0);
            map.putDouble("size", cursor.getLong(5));
            String mime = cursor.getString(6);
            map.putString("mime", mime == null ? "" : mime);
            result.pushMap(map);
          }
        } catch (Exception ignored) {
          // 单个卷查询失败不影响其他卷
        } finally {
          if (cursor != null) cursor.close();
        }
      }
      promise.resolve(result);
    } catch (Exception err) {
      promise.reject("SCAN_ERROR", err);
    }
  }

  /**
   * 【v34】列出所有「扫到疑似音乐」的文件夹（与 scanAudio 相同的过滤条件聚合去重）。
   * 返回: [{path, count}]，path 为父目录绝对路径，count 为该目录下的音乐文件数。
   * 用于扫描范围选择器：默认全部勾选，用户取消勾选的文件夹不参与扫描。
   */
  @SuppressLint("Recycle")
  @ReactMethod
  public void getAudioFolders(final Promise promise) {
    try {
      Context context = reactContext;

      List<Uri> uris = new java.util.ArrayList<>();
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        for (String volume : MediaStore.getExternalVolumeNames(context)) {
          uris.add(MediaStore.Audio.Media.getContentUri(volume));
        }
      } else {
        uris.add(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI);
      }

      String[] projection = new String[]{
        MediaStore.Audio.Media.DATA,
        MediaStore.Audio.Media.DURATION,
        MediaStore.Audio.Media.IS_RINGTONE,
        MediaStore.Audio.Media.IS_ALARM,
        MediaStore.Audio.Media.IS_NOTIFICATION,
      };

      // LinkedHashMap 保持首次出现顺序，最后按路径排序
      java.util.Map<String, Integer> folders = new java.util.LinkedHashMap<>();
      for (Uri uri : uris) {
        Cursor cursor = null;
        try {
          cursor = context.getContentResolver().query(uri, projection, null, null, null);
          if (cursor == null) continue;
          while (cursor.moveToNext()) {
            String path = cursor.getString(0);
            if (path == null || path.isEmpty()) continue;
            if (cursor.getInt(2) == 1 || cursor.getInt(3) == 1 || cursor.getInt(4) == 1) continue;
            String pathLower = '/' + path.toLowerCase() + '/';
            boolean excluded = false;
            for (String seg : EXCLUDED_PATH_SEGMENTS) {
              if (pathLower.contains(seg)) {
                excluded = true;
                break;
              }
            }
            if (excluded) continue;
            long duration = cursor.getLong(1);
            if (duration > 0 && duration < MIN_DURATION_SECONDS * 1000) continue;
            int lastSlash = path.lastIndexOf('/');
            if (lastSlash <= 0) continue;
            String folder = path.substring(0, lastSlash);
            folders.merge(folder, 1, Integer::sum);
          }
        } catch (Exception ignored) {
          // 单个卷查询失败不影响其他卷
        } finally {
          if (cursor != null) cursor.close();
        }
      }

      WritableArray result = Arguments.createArray();
      java.util.List<String> keys = new java.util.ArrayList<>(folders.keySet());
      java.util.Collections.sort(keys);
      for (String folder : keys) {
        WritableMap map = Arguments.createMap();
        map.putString("path", folder);
        map.putInt("count", folders.get(folder));
        result.pushMap(map);
      }
      promise.resolve(result);
    } catch (Exception err) {
      promise.reject("SCAN_ERROR", err);
    }
  }

  /**
   * 【v40】列出当前已挂载的存储卷根路径（内置存储 + 已插入的 U 盘/SD 卡）。
   * 返回: ["/storage/emulated/0", "/mnt/media_rw/XXXX", ...]
   * 用途：U 盘拔出后，其路径不属于任何已挂载卷 —— 重扫时这类文件不参与
   * 「已删除」判定，本地列表保留，重新插入后再增量合并。
   */
  @SuppressLint("Recycle")
  @ReactMethod
  public void getMountedRoots(final Promise promise) {
    try {
      Context context = reactContext;
      WritableArray result = Arguments.createArray();
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        StorageManager sm = (StorageManager) context.getSystemService(Context.STORAGE_SERVICE);
        if (sm != null) {
          for (StorageVolume volume : sm.getStorageVolumes()) {
            try {
              if (!Environment.MEDIA_MOUNTED.equals(volume.getState())) continue;
              java.io.File dir = volume.getDirectory();
              if (dir != null) result.pushString(dir.getAbsolutePath());
            } catch (Throwable ignored) {
              // 单个卷状态读取失败不影响其他卷
            }
          }
        }
      } else {
        // 旧版本：只有主存储一个概念
        java.io.File external = Environment.getExternalStorageDirectory();
        if (external != null && Environment.getExternalStorageState().equals(Environment.MEDIA_MOUNTED)) {
          result.pushString(external.getAbsolutePath());
        }
      }
      promise.resolve(result);
    } catch (Exception err) {
      promise.reject("SCAN_ERROR", err);
    }
  }

  /**
   * 【v62】流式下载到 SAF 授权目录（U 盘）。
   * 背景：车机 Android 9 + exFAT 下，直接路径（/storage/XXXX-XXXX）长时间流式写 U 盘
   * 易触发 exFAT 驱动 I/O 错误、导致系统卸载重挂载 U 盘；改用 SAF 授权目录
   * （DocumentsProvider + ContentResolver 写入），换一条底层写入通道，规避该问题。
   *
   * @param treeUri  授权目录的 tree URI（content://com.android.externalstorage.documents/tree/...）
   * @param url      音源直链
   * @param fileName 目标文件名（含扩展名）
   * @param ua       请求 User-Agent
   */
  @ReactMethod
  public void downloadToTree(String treeUri, String url, String fileName, String ua, final Promise promise) {
    HttpURLConnection conn = null;
    InputStream in = null;
    OutputStream out = null;
    try {
      Context context = reactContext;
      Uri tree = Uri.parse(treeUri);
      DocumentFile dir = DocumentFile.fromTreeUri(context, tree);
      if (dir == null || !dir.canWrite()) {
        promise.reject("SAF_ERROR", "directory not writable");
        return;
      }

      // 打开连接
      URL u = new URL(url);
      conn = (HttpURLConnection) u.openConnection();
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(15000);
      conn.setReadTimeout(30000);
      conn.setInstanceFollowRedirects(true);
      if (ua != null && !ua.isEmpty()) conn.setRequestProperty("User-Agent", ua);
      conn.connect();
      int code = conn.getResponseCode();
      if (code < 200 || code >= 300) {
        promise.reject("HTTP_ERROR", "HTTP " + code);
        return;
      }

      // 重名加后缀：base(1).ext
      String targetName = fileName;
      String base = fileName;
      String ext = "";
      int dot = fileName.lastIndexOf('.');
      if (dot > 0) {
        base = fileName.substring(0, dot);
        ext = fileName.substring(dot);
      }
      for (int i = 1; i < 100 && dir.findFile(targetName) != null; i++) {
        targetName = base + "(" + i + ")" + ext;
      }

      DocumentFile file = dir.createFile("*/*", targetName);
      if (file == null) {
        promise.reject("SAF_ERROR", "create file failed: " + targetName);
        return;
      }

      // 流式复制
      in = conn.getInputStream();
      out = context.getContentResolver().openOutputStream(file.getUri(), "w");
      if (out == null) {
        promise.reject("SAF_ERROR", "open output stream failed");
        return;
      }
      byte[] buf = new byte[65536];
      int read;
      long total = 0;
      while ((read = in.read(buf)) != -1) {
        out.write(buf, 0, read);
        total += read;
      }
      out.flush();

      WritableMap result = Arguments.createMap();
      result.putString("filePath", file.getUri().toString());
      result.putString("fileName", targetName);
      result.putDouble("size", total);
      promise.resolve(result);
    } catch (Exception err) {
      promise.reject("SAF_ERROR", err.toString());
    } finally {
      try { if (out != null) out.close(); } catch (Exception ignored) {}
      try { if (in != null) in.close(); } catch (Exception ignored) {}
      if (conn != null) conn.disconnect();
    }
  }
}
