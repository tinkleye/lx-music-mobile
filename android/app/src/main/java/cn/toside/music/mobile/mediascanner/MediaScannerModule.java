package cn.toside.music.mobile.mediascanner;

import android.annotation.SuppressLint;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.List;

/**
 * 【车机改造】本地音乐扫描：基于系统 MediaStore 索引（零重复扫描开销），
 * 覆盖内置存储与所有已挂载的外置卷（U 盘）。
 */
public class MediaScannerModule extends ReactContextBaseJavaModule {

  private final ReactApplicationContext reactContext;

  MediaScannerModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "MediaScannerModule";
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
            WritableMap map = Arguments.createMap();
            map.putString("path", path);
            map.putString("title", cursor.getString(1));
            String artist = cursor.getString(2);
            map.putString("artist", (artist == null || "<unknown>".equalsIgnoreCase(artist)) ? "" : artist);
            map.putString("album", cursor.getString(3) == null ? "" : cursor.getString(3));
            long duration = cursor.getLong(4);
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
}
