package cn.toside.music.mobile.audiofx;

import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;

import java.util.HashMap;
import java.util.Map;

/**
 * 【车机改造】均衡器/重低音：把系统音频特效挂到播放器的音频会话上。
 * 依赖 track-player fork 暴露的 getAudioSessionId。
 */
public class AudioFxModule extends ReactContextBaseJavaModule {

  private final ReactApplicationContext reactContext;
  private Equalizer equalizer = null;
  private BassBoost bassBoost = null;
  private int sessionId = -1;

  AudioFxModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "AudioFxModule";
  }

  private void releaseFx() {
    if (equalizer != null) {
      try { equalizer.release(); } catch (Exception ignored) {}
      equalizer = null;
    }
    if (bassBoost != null) {
      try { bassBoost.release(); } catch (Exception ignored) {}
      bassBoost = null;
    }
  }

  /**
   * 挂载音频特效到指定会话；sessionId <= 0 表示释放
   */
  @ReactMethod
  public void attach(final int sessionId, final Promise promise) {
    try {
      if (sessionId <= 0) {
        releaseFx();
        this.sessionId = -1;
        promise.resolve(false);
        return;
      }
      if (this.sessionId == sessionId && equalizer != null) {
        promise.resolve(true);
        return;
      }
      releaseFx();
      this.sessionId = sessionId;
      this.equalizer = new Equalizer(0, sessionId);
      this.bassBoost = new BassBoost(0, sessionId);
      this.equalizer.setEnabled(true);
      promise.resolve(true);
    } catch (Exception err) {
      releaseFx();
      this.sessionId = -1;
      promise.reject("FX_ERROR", err);
    }
  }

  @ReactMethod
  public void detach(final Promise promise) {
    releaseFx();
    this.sessionId = -1;
    promise.resolve(null);
  }

  @ReactMethod
  public void getBandCount(final Promise promise) {
    try {
      if (equalizer == null) {
        promise.resolve(0);
        return;
      }
      promise.resolve(equalizer.getNumberOfBands());
    } catch (Exception err) {
      promise.reject("FX_ERROR", err);
    }
  }

  /**
   * 批量设置各频段增益（毫贝，short），数组长度需与频段数一致
   */
  @ReactMethod
  public void setBandLevels(final com.facebook.react.bridge.ReadableArray levels, final Promise promise) {
    try {
      if (equalizer == null || levels == null) {
        promise.resolve(null);
        return;
      }
      short count = equalizer.getNumberOfBands();
      for (short i = 0; i < count && i < levels.size(); i++) {
        equalizer.setBandLevel(i, (short) levels.getInt(i));
      }
      promise.resolve(null);
    } catch (Exception err) {
      promise.reject("FX_ERROR", err);
    }
  }

  /**
   * 重低音强度（0 - 1000）
   */
  @ReactMethod
  public void setBassBoost(final int strength, final Promise promise) {
    try {
      if (bassBoost != null) {
        bassBoost.setStrength((short) Math.max(0, Math.min(1000, strength)));
      }
      promise.resolve(null);
    } catch (Exception err) {
      promise.reject("FX_ERROR", err);
    }
  }

  @ReactMethod
  public void setEnabled(final boolean enabled, final Promise promise) {
    try {
      if (equalizer != null) equalizer.setEnabled(enabled);
      if (bassBoost != null) bassBoost.setEnabled(enabled);
      promise.resolve(null);
    } catch (Exception err) {
      promise.reject("FX_ERROR", err);
    }
  }
}
