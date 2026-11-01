package cn.toside.music.mobile;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import com.reactnativenavigation.NavigationActivity;

/**
 * 【改造】打开 App 即进入沉浸式全屏。
 *
 * 做的事情：
 * 1. 隐藏顶部状态栏（时间/电量那条）和底部虚拟导航键；
 * 2. 系统栏被任何原因重新唤出后（下拉通知栏、切换页面、输入法弹出），会自动再隐藏；
 * 3. 保留「上滑临时唤出」的系统行为（IMMERSIVE_STICKY），几秒后自动缩回。
 *
 * 横屏锁定不在这里，写在 AndroidManifest.xml 的 android:screenOrientation="sensorLandscape"，
 * 这样「只改一个地方」就能恢复成跟随重力感应。
 */
public class MainActivity extends NavigationActivity {

  /**
   * 全屏总开关。
   * 想临时恢复官方原样（带状态栏），把这里改成 false 重新编译即可。
   */
  private static final boolean ENABLE_IMMERSIVE_FULLSCREEN = true;

  /**
   * 系统栏被唤出后，隔多久重新隐藏（毫秒）。
   * 调大 = 上滑唤出的系统栏停留更久；调小 = 更"霸道"地一直保持全屏。
   */
  private static final long REHIDE_DELAY_MS = 1000L;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    if (!ENABLE_IMMERSIVE_FULLSCREEN) return;

    final View decorView = getWindow().getDecorView();

    // 兜底：react-native-navigation 在切换页面、应用页面配置时可能会重设系统栏可见性，
    // 所以监听系统栏变化 —— 一旦状态栏又冒出来，延时一点再把它盖回去。
    decorView.setOnSystemUiVisibilityChangeListener(visibility -> {
      if ((visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0) {
        decorView.postDelayed(this::applyImmersiveFullscreen, REHIDE_DELAY_MS);
      }
    });

    applyImmersiveFullscreen();
  }

  @Override
  protected void onResume() {
    super.onResume();
    // 从后台 / 锁屏 / 通知栏返回时补一次
    applyImmersiveFullscreen();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    // 输入法收起、音量条消失后重新获得焦点时也补一次
    if (hasFocus) applyImmersiveFullscreen();
  }

  private void applyImmersiveFullscreen() {
    if (!ENABLE_IMMERSIVE_FULLSCREEN) return;

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
  }
}
