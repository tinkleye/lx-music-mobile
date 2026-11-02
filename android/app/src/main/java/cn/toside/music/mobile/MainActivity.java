package cn.toside.music.mobile;

import android.os.Build;
import android.os.Bundle;
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
 * 【为什么回到"钝"策略（重要）】
 *
 * 曾经试过更激进的方案：窗口属性一变就同步补、每 300ms 轮询守护、
 * 系统栏一冒出来 200ms 内补齐。实测在车机上反而让空调栏"闪现"——
 * 因为导航库在页面切换动画期间会多次改动窗口标志，我们每次都立刻对抗回去，
 * 双方拉锯，空调栏就反复收到显示/隐藏指令。
 *
 * 第一版（打开即全屏那版）用户实测没有闪现，它的策略是"钝"的：
 *   - 不做轮询、不做窗口属性监听；
 *   - 只在三个时机一次性补全：onCreate、onResume、onWindowFocusChanged；
 *   - 系统栏可见性变化时延时 1 秒再补。
 * 页面切换完成、焦点恢复的那一刻补全，恰好赶在空调栏弹出动画开始之前，
 * 所以用户看不到闪。本版完整恢复这个机制，只加上车机模式的动态开关。
 *
 * 横屏锁定不在这里，写在 AndroidManifest.xml 的 android:screenOrientation="sensorLandscape"。
 *
 * 【稳定性约定】全屏是可选的显示效果，任何一步失败都不应影响 App 运行，
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
   * 调大 = 上滑唤出的系统栏停留更久；调小 = 更"霸道"地一直保持全屏。
   * 保持第一版的 1000ms —— 这个延时实测不影响车机空调栏的隐藏体验。
   */
  private static final long REHIDE_DELAY_MS = 1000L;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    currentInstance = this;

    installCrashLogger();

    try {
      final View decorView = getWindow().getDecorView();

      // 兜底：react-native-navigation 在切换页面、应用页面配置时可能会重设系统栏可见性，
      // 所以监听系统栏变化 —— 一旦状态栏又冒出来，延时一点再把它盖回去。
      decorView.setOnSystemUiVisibilityChangeListener(visibility -> {
        if (!immersiveEnabled) return;
        try {
          if ((visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0) {
            decorView.postDelayed(this::applyImmersiveFullscreen, REHIDE_DELAY_MS);
          }
        } catch (Throwable ignored) {
        }
      });

      applyImmersiveFullscreen();
    } catch (Throwable ignored) {
      // 拿不到 DecorView 就放弃监听，onResume / onWindowFocusChanged 仍然会补
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    currentInstance = this;
    // 从后台 / 锁屏 / 通知栏返回时补一次
    if (immersiveEnabled) applyImmersiveFullscreen();
  }

  @Override
  protected void onPause() {
    // 离开界面（被其他应用/弹窗盖住）期间不再做任何修补
    // （第一版没有这句，是配合开关加的，行为不受影响）
    super.onPause();
  }

  @Override
  protected void onDestroy() {
    if (currentInstance == this) currentInstance = null;
    super.onDestroy();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    // 输入法收起、音量条消失后重新获得焦点时也补一次。
    // 页面切换完成后焦点恢复也会走到这里 —— 这正是第一版"不闪"的关键时机：
    // 在此刻一次性补全，赶在空调栏弹出动画开始之前。
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
        } else {
          activity.exitImmersiveFullscreen();
        }
      } catch (Throwable ignored) {
      }
    });
  }

  private void applyImmersiveFullscreen() {
    if (!immersiveEnabled) return;

    try {
      Window window = getWindow();

      // 状态栏 / 导航栏区域变透明，内容才能真正延伸到整块屏幕（Android 5.0+）
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(0x00000000);
        window.setNavigationBarColor(0x00000000);
      }

      // 【车机兼容】很多车机的空调栏是挂在系统栏上的，但它判断"要不要隐藏"时
      // 只看窗口级的 FLAG_FULLSCREEN，不认下面的 SYSTEM_UI 标志。
      // 补上这个标志能显著提高车机上自动隐藏空调栏的成功率，手机上则等同于无副作用。
      window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

      int uiOptions = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN  // 内容铺到状态栏底下
        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION   // 隐藏底部导航键
        | View.SYSTEM_UI_FLAG_FULLSCREEN        // 隐藏顶部状态栏
        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY; // 上滑临时唤出后自动缩回

      window.getDecorView().setSystemUiVisibility(uiOptions);
    } catch (Throwable ignored) {
    }
  }

  /**
   * 关闭全屏：把系统栏（状态栏 + 导航栏）还原出来。
   */
  private void exitImmersiveFullscreen() {
    try {
      Window window = getWindow();
      window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
      window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
    } catch (Throwable ignored) {
    }
  }

  /**
   * 【排障用】把未捕获异常的堆栈写到 App 私有外部目录，方便定位闪退。
   *
   * 路径：Android/data/cn.toside.music.mobile/files/crash.log
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
}
