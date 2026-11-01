package cn.toside.music.mobile.userApi;

import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.util.Log;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/**
 * 【改造】支持同时加载多个自定义源（主源 + 备用源）。
 *
 * 原实现只有一个 javaScriptThread，加载新脚本会先把旧的销毁掉，
 * 因此备用源无法与主源共存。这里改为按 apiId 维护一张表，
 * 每个源各自持有独立的线程与 QuickJS 上下文，互不影响；
 * 每次调用 shareAction 时显式指定 apiId，事件也会带上 apiId 回传给 JS 层。
 */
public class UserApiModule extends ReactContextBaseJavaModule {
  private final Map<String, JavaScriptThread> javaScriptThreads = new HashMap<>();
  private final ReactApplicationContext reactContext;
  private UtilsEvent utilsEvent;

  private int listenerCount = 0;

  UserApiModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.utilsEvent = null;
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "UserApiModule";
  }

  @ReactMethod
  public void addListener(String eventName) {
    if (listenerCount == 0) {
      // Set up any upstream listeners or background tasks as necessary
    }

    listenerCount += 1;
  }

  @ReactMethod
  public void removeListeners(Integer count) {
    listenerCount -= count;
    if (listenerCount == 0) {
      // Remove upstream listeners, stop unnecessary background tasks
    }
  }

  @ReactMethod
  public void loadScript(ReadableMap data) {
    if (this.utilsEvent == null) this.utilsEvent = new UtilsEvent(this.reactContext);
    Bundle info = Arguments.toBundle(data);
    String apiId = info != null ? info.getString("id", "") : "";
    if (apiId == null || apiId.isEmpty()) apiId = "default";

    // 同一个源重复加载时先销毁旧线程，避免两个上下文同时存在
    destroyScript(apiId);

    final JavaScriptThread javaScriptThread = new JavaScriptThread(this.reactContext, info);
    javaScriptThread.prepareHandler(new JsHandler(this.reactContext.getMainLooper(), this.utilsEvent, apiId));
    javaScriptThread.getHandler().sendEmptyMessage(HandlerWhat.INIT);
    javaScriptThread.setUncaughtExceptionHandler((thread, ex) -> {
      Handler jsHandler = javaScriptThread.getHandler();
      if (jsHandler == null) return;
      Message message = jsHandler.obtainMessage();
      message.what = HandlerWhat.LOG;
      message.obj = new Object[]{"error", "Uncaught exception in JavaScriptThread: " + ex.getMessage()};
      jsHandler.sendMessage(message);
      Log.e("JavaScriptThread", "Uncaught exception in JavaScriptThread: " + ex.getMessage());
    });
    this.javaScriptThreads.put(apiId, javaScriptThread);
    Log.d("UserApi", "Module Thread id: " + Thread.currentThread().getId() + ", apiId: " + apiId);
  }

  @ReactMethod
  public boolean sendAction(String apiId, String action, String info) {
    JavaScriptThread javaScriptThread = this.javaScriptThreads.get(apiId);
    if (javaScriptThread == null && this.javaScriptThreads.size() == 1) {
      // 兼容没有传 apiId 的旧调用
      javaScriptThread = this.javaScriptThreads.values().iterator().next();
    }
    if (javaScriptThread == null) return false;
    Handler jsHandler = javaScriptThread.getHandler();
    if (jsHandler == null) return false;
    Message message = jsHandler.obtainMessage();
    message.what = HandlerWhat.ACTION;
    message.obj = new Object[]{action, info};
    jsHandler.sendMessage(message);
    return true;
  }

  @ReactMethod
  public void destroyScript(String apiId) {
    JavaScriptThread javaScriptThread = this.javaScriptThreads.remove(apiId);
    if (javaScriptThread == null) return;
    Handler jsHandler = javaScriptThread.getHandler();
    if (jsHandler != null) jsHandler.sendEmptyMessage(HandlerWhat.DESTROY);
    javaScriptThread.stopThread();
  }

  @ReactMethod
  public void destroy() {
    for (String apiId : new ArrayList<>(this.javaScriptThreads.keySet())) {
      destroyScript(apiId);
    }
  }
}
