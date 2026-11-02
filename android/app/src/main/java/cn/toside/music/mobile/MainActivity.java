package cn.toside.music.mobile;

import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import com.reactnativenavigation.NavigationActivity;

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
   */
  private static final long REHIDE_DELAY_MS = 1000L;

  /**
   * 【全屏守护】检查窗口全屏状态的间隔（毫秒）。
   *
   * 为什么要轮询：react-native-navigation 在 setRoot / push 新页面（比如点开播放页）
   * 时会重新应用目标页面的窗口参数，其中会 clearFlags(FLAG_FULLSCREEN)。
   * 这个动作只改窗口属性，不改 View 的 systemUiVisibility，
   * 所以 setOnSystemUiVisibilityChangeListener 根本收不到通知 —— 全屏就丢了。
   * 车机判断"要不要隐藏底部空调栏"看的正是 FLAG_FULLSCREEN，于是空调栏会冒出来。
   * 这里每秒校验一次，发现被清掉就立刻补回去，代价只是读一个 int 做比较。
   */
  private static final long GUARD_INTERVAL_MS = 500L;

  private final Handler guardHandler = new Handler(Looper.getMainLooper());
  /** 防止"补全屏"这个动作本身触发回调、又触发补全屏，形成死循环 */
  private boolean reapplying = false;
  /** 连续补齐失败次数：用来退避，避免在拒绝全屏的车机上反复修补导致状态栏闪烁 */
  private int guardMissCount = 0;

  private final Runnable guardRunnable = new Runnable() {
    @Override
    public void run() {
      if (!immersiveEnabled) return;
      if (isImmersiveActive()) {
        guardMissCount = 0;
      } else {
        guardMissCount++;
        // 正常情况最多连补几次就能稳住；连补 5 次还不行说明这台机器不让全屏，
        // 就别再高频重试了，拉长间隔降到 3 秒一次，避免画面闪
        if (guardMissCount <= 5) applyImmersiveFullscreen();
      }
      guardHandler.postDelayed(this, guardMissCount > 5 ? 3000L : GUARD_INTERVAL_MS);
    }
  };

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    currentInstance = this;

    final View decorView = getWindow().getDecorView();

    // 兜底一：View 层系统栏可见性变化（上滑唤出、RN 的 StatusBar 改动）时补回去
    decorView.setOnSystemUiVisibilityChangeListener(visibility -> {
      if (!immersiveEnabled) return;
      // 不管是哪一位变了，只要不是目标全屏状态就重新应用
      if (!isImmersiveActive()) {
        decorView.postDelayed(this::applyImmersiveFullscreen, REHIDE_DELAY_MS);
      }
    });

    applyImmersiveFullscreen();
  }

  /**
   * 兜底二：窗口属性（flags）变化时检查。
   *
   * react-native-navigation 切换页面会 clearFlags(FLAG_FULLSCREEN)，走的是这条路，
   * 上面那个 View 层监听收不到。补在这里，切换完成后立即恢复，用户看不到空调栏闪出。
   */
  @Override
  public void onWindowAttributesChanged(WindowManager.LayoutParams params) {
    super.onWindowAttributesChanged(params);
    if (!immersiveEnabled || reapplying) return;
    if ((params.flags & WindowManager.LayoutParams.FLAG_FULLSCREEN) == 0) {
      reapplying = true;
      getWindow().getDecorView().post(() -> {
        reapplying = false;
        if (immersiveEnabled) applyImmersiveFullscreen();
      });
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    currentInstance = this;
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
      if (enable) {
        activity.applyImmersiveFullscreen();
        activity.startGuard();
      } else {
        activity.stopGuard();
        activity.exitImmersiveFullscreen();
      }
    });
  }

  private void startGuard() {
    guardHandler.removeCallbacks(guardRunnable);
    guardHandler.postDelayed(guardRunnable, GUARD_INTERVAL_MS);
  }

  private void stopGuard() {
    guardHandler.removeCallbacks(guardRunnable);
  }

  /**
   * 当前窗口是否处于"目标全屏状态"：窗口标志和 View 标志都要在。
   * 只要缺一项就认为被外部重置过，需要重新应用。
   */
  private boolean isImmersiveActive() {
    Window window = getWindow();
    if (window == null) return true;

    boolean windowFlagOk = (window.getAttributes().flags & WindowManager.LayoutParams.FLAG_FULLSCREEN) != 0;
    if (!windowFlagOk) return false;

    int visibility = window.getDecorView().getSystemUiVisibility();
    boolean statusBarHidden = (visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) != 0;
    boolean navBarHidden = (visibility & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) != 0;
    return statusBarHidden && navBarHidden;
  }

  private void applyImmersiveFullscreen() {
    if (!immersiveEnabled) return;

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

    window.getDecorView().setSystemUiVisibility(uiOptions);

    // 【车机兼容】很多车机的空调栏是挂在系统栏上的，但它判断"要不要隐藏"时
    // 只看窗口级的 FLAG_FULLSCREEN，不认上面的 SYSTEM_UI 标志。
    // 注意这会放在 setSystemUiVisibility 之后：某些系统在设置 View 标志时
    // 会顺带重置窗口标志，放在后面才留得住。
    window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
  }

  /**
   * 关闭全屏：把系统栏（状态栏 + 导航栏）还原出来。
   */
  private void exitImmersiveFullscreen() {
    Window window = getWindow();
    if (window == null) return;
    window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
    window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
  }
}
