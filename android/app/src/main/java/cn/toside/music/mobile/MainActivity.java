package cn.toside.music.mobile;

import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import com.reactnativenavigation.NavigationActivity;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 【改造】打开 App 即进入沉浸式全屏，并支持在设置页里随时开关。
 *
 * 做的事情：
 * 1. 隐藏顶部状态栏（时间/电量那条）和底部虚拟导航键；
 * 2. 系统栏被任何原因重新唤出后（下拉通知栏、切换页面、输入法弹出），会自动再隐藏；
 * 3. 保留「上滑临时唤出」的系统行为（IMMERSIVE_STICKY），几秒后自动缩回；
 * 4. 由 JS 调用 {@link #setFullscreenEnabled(boolean)} 可实时开/关（跟随「车机模式」开关）。
 *
 * 横屏锁定不在这里，写在 AndroidManifest.xml 的 android:screenOrientation="sensorLandscape"，
 * 这样「只改一个地方」就能恢复成跟随重力感应。
 *
 * 【稳定性约定】这里做的都是可选的显示效果，任何一步失败都不应影响 App 运行，
 * 所以每个系统调用都用 try-catch 兜住，出异常就静默跳过。
 */
public class MainActivity extends NavigationActivity {

  /**
   * 当前 Activity 实例，供 JS 通过 UtilsModule 反查。
   */
  private static MainActivity currentInstance;

  /**
   * 全屏开关（运行期可变）。
   *
   * 默认 true：App 一启动就是全屏，不会先闪一下状态栏。
   * JS 初始化完成后会读取「车机模式」开关，若用户关掉了车机模式，会调用
   * setFullscreenEnabled(false) 退出全屏。
   */
  private static boolean immersiveEnabled = true;

  /**
   * 系统栏被唤出后，隔多久重新隐藏（毫秒）。
   */
  private static final long REHIDE_DELAY_MS = 1000L;

  /**
   * 【全屏守护】检查窗口全屏状态的间隔（毫秒）。
   *
   * 为什么要检查：react-native-navigation 在 setRoot / push 新页面（比如点开播放页）
   * 时会重新应用目标页面的窗口参数，其中会 clearFlags(FLAG_FULLSCREEN)。
   * 这个动作只改窗口属性、不改 View 的 systemUiVisibility，
   * 所以 setOnSystemUiVisibilityChangeListener 收不到通知 —— 全屏就丢了。
   * 车机判断"要不要隐藏底部空调栏"看的正是 FLAG_FULLSCREEN，于是空调栏会冒出来。
   */
  private static final long GUARD_INTERVAL_MS = 300L;

  /** 字段初始化：可能在 onCreate 之前就被回调使用，必须提前存在 */
  private final Handler guardHandler = new Handler(Looper.getMainLooper());

  /** onCreate 里缓存，避免任何回调路径去 getDecorView() 触发提前创建视图 */
  private View cachedDecorView;

  /** 防止"补全屏"这个动作本身触发回调、又触发补全屏，形成死循环 */
  private boolean reapplying = false;
  /** 连续补齐失败次数：用来退避，避免在拒绝全屏的车机上反复修补导致闪烁 */
  private int guardMissCount = 0;

  private final Runnable guardRunnable = new Runnable() {
    @Override
    public void run() {
      if (!immersiveEnabled) return;
      try {
        if (isImmersiveActive()) {
          guardMissCount = 0;
        } else {
          guardMissCount++;
          // 正常情况连补几次就能稳住；连补 5 次还不行说明这台机器不让全屏，
          // 就别再高频重试了，拉长间隔降到 3 秒一次，避免画面闪
          if (guardMissCount <= 5) applyImmersiveFullscreen();
        }
      } catch (Throwable ignored) {
        // 全屏是附加效果，出任何问题都不能影响 App 运行
      }
      try {
        guardHandler.postDelayed(this, guardMissCount > 5 ? 3000L : GUARD_INTERVAL_MS);
      } catch (Throwable ignored) {
      }
    }
  };

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    currentInstance = this;

    installCrashLogger();

    try {
      cachedDecorView = getWindow().getDecorView();
      cachedDecorView.setOnSystemUiVisibilityChangeListener(visibility -> {
        if (!immersiveEnabled) return;
        try {
          if (!isImmersiveActive()) {
            guardHandler.postDelayed(this::applyImmersiveFullscreen, REHIDE_DELAY_MS);
          }
        } catch (Throwable ignored) {
        }
      });
    } catch (Throwable ignored) {
      // 拿不到 DecorView 就放弃这一层监听，后面的守护轮询仍然有效
    }

    applyImmersiveFullscreen();
  }

  /**
   * 兜底二：窗口属性（flags）变化时检查。
   *
   * react-native-navigation 切换页面会 clearFlags(FLAG_FULLSCREEN)，走的是这条路，
   * 上面的 View 层监听收不到。
   *
   * 注意：这个方法可能在 onCreate 之前、DecorView 还没创建时就被系统回调。
   * 所以这里【绝对不能】碰 getDecorView() —— 那会强制提前创建视图，
   * 与导航库随后的 setContentView 冲突，表现就是一启动就闪退。
   * 窗口标志用 addFlags 同步补（不涉及视图，安全）；View 标志交给下一个消息循环补。
   */
  @Override
  public void onWindowAttributesChanged(WindowManager.LayoutParams params) {
    try {
      super.onWindowAttributesChanged(params);
    } catch (Throwable ignored) {
    }
    try {
      if (!immersiveEnabled || params == null) return;
      if ((params.flags & WindowManager.LayoutParams.FLAG_FULLSCREEN) != 0) return;

      // 关键：这里【同步】把标志补回去，不要等到下一帧。
      // 车机的空调栏是看到 FLAG_FULLSCREEN 消失就立刻弹出的，
      // 哪怕只晚一帧，用户也会看到空调栏"闪一下再缩回去"。
      // 回调本身发生在窗口属性已应用、但还没绘制的时候，同步补等于没有空档。
      Window window = getWindow();
      if (window != null) window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

      // View 层的 systemUiVisibility 也要一起补齐（这部分交给下一个消息循环做，
      // 避免在窗口属性回调里直接操作视图引发重入问题）
      if (reapplying) return;
      reapplying = true;
      guardHandler.post(() -> {
        reapplying = false;
        if (immersiveEnabled) applyImmersiveFullscreen();
      });
    } catch (Throwable ignored) {
    }
  }

  /**
   * 【排障用】把未捕获异常的堆栈写到 App 私有外部目录，方便定位闪退。
   *
   * 路径：Android/data/cn.toside.music.mobile/files/crash.log
   * 文件里是崩溃时间 + 完整堆栈；定位不了就删掉，不影响任何功能。
   * 整个逻辑全部 try-catch，写不进去就算了，绝不因为它自己再崩一次。
   */
  private static boolean crashLoggerInstalled = false;

  private void installCrashLogger() {
    if (crashLoggerInstalled) return;
    crashLoggerInstalled = true;
    try {
      final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
      Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
        try {
          File dir = getExternalFilesDir(null);
          if (dir != null) {
            File logFile = new File(dir, "crash.log");
            StringWriter buffer = new StringWriter();
            throwable.printStackTrace(new PrintWriter(buffer));
            FileWriter writer = new FileWriter(logFile, false);
            writer.write(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date())
              + "  thread=" + thread.getName() + "\n");
            writer.write(buffer.toString());
            writer.close();
          }
        } catch (Throwable ignored) {
        }
        if (previous != null) previous.uncaughtException(thread, throwable);
      });
    } catch (Throwable ignored) {
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    currentInstance = this;
    try {
      if (cachedDecorView == null) cachedDecorView = getWindow().getDecorView();
    } catch (Throwable ignored) {
    }
    // 从后台 / 锁屏 / 通知栏返回时补一次
    if (immersiveEnabled) {
      applyImmersiveFullscreen();
      startGuard();
    }
  }

  @Override
  protected void onPause() {
    stopGuard();
    super.onPause();
  }

  @Override
  protected void onDestroy() {
    stopGuard();
    if (currentInstance == this) currentInstance = null;
    super.onDestroy();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    // 输入法收起、音量条消失后重新获得焦点时也补一次
    if (hasFocus && immersiveEnabled) applyImmersiveFullscreen();
  }

  /**
   * 供 JS 调用：开/关沉浸式全屏。
   * 设置页切换开关时即时生效，不需要重启 App。
   */
  public static void setFullscreenEnabled(boolean enable) {
    immersiveEnabled = enable;
    MainActivity activity = currentInstance;
    if (activity == null) return;
    activity.runOnUiThread(() -> {
      try {
        if (enable) {
          activity.applyImmersiveFullscreen();
          activity.startGuard();
        } else {
          activity.stopGuard();
          activity.exitImmersiveFullscreen();
        }
      } catch (Throwable ignored) {
      }
    });
  }

  private void startGuard() {
    try {
      guardHandler.removeCallbacks(guardRunnable);
      guardHandler.postDelayed(guardRunnable, GUARD_INTERVAL_MS);
    } catch (Throwable ignored) {
    }
  }

  private void stopGuard() {
    try {
      guardHandler.removeCallbacks(guardRunnable);
    } catch (Throwable ignored) {
    }
  }

  /**
   * 当前窗口是否处于"目标全屏状态"：窗口标志和 View 标志都要在。
   * 只要缺一项就认为被外部重置过，需要重新应用。
   */
  private boolean isImmersiveActive() {
    try {
      Window window = getWindow();
      if (window == null) return true;

      boolean windowFlagOk = (window.getAttributes().flags & WindowManager.LayoutParams.FLAG_FULLSCREEN) != 0;
      if (!windowFlagOk) return false;

      View decorView = cachedDecorView;
      if (decorView == null) return false;

      int visibility = decorView.getSystemUiVisibility();
      boolean statusBarHidden = (visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) != 0;
      boolean navBarHidden = (visibility & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) != 0;
      return statusBarHidden && navBarHidden;
    } catch (Throwable ignored) {
      // 读不到状态就当它正常，避免无意义地反复修补
      return true;
    }
  }

  private void applyImmersiveFullscreen() {
    if (!immersiveEnabled) return;

    try {
      Window window = getWindow();
      if (window == null) return;

      // 状态栏 / 导航栏区域变透明，内容才能真正延伸到整块屏幕（Android 5.0+）
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(0x00000000);
        window.setNavigationBarColor(0x00000000);
      }

      int uiOptions = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN  // 内容铺到状态栏底下
        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION   // 隐藏底部导航键
        | View.SYSTEM_UI_FLAG_FULLSCREEN        // 隐藏顶部状态栏
        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY; // 上滑临时唤出后自动缩回

      View decorView = cachedDecorView;
      if (decorView == null) {
        decorView = window.getDecorView();
        cachedDecorView = decorView;
      }
      if (decorView == null) return;
      decorView.setSystemUiVisibility(uiOptions);

      // 【车机兼容】很多车机的空调栏是挂在系统栏上的，但它判断"要不要隐藏"时
      // 只看窗口级的 FLAG_FULLSCREEN，不认上面的 SYSTEM_UI 标志。
      // 放在 setSystemUiVisibility 之后：某些系统设置 View 标志时会顺带重置窗口标志。
      window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
    } catch (Throwable ignored) {
      // 全屏失败不影响 App 正常使用
    }
  }

  /**
   * 关闭全屏：把系统栏（状态栏 + 导航栏）还原出来。
   */
  private void exitImmersiveFullscreen() {
    try {
      Window window = getWindow();
      if (window == null) return;
      window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
      View decorView = cachedDecorView != null ? cachedDecorView : window.getDecorView();
      if (decorView != null) decorView.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
    } catch (Throwable ignored) {
    }
  }
}
