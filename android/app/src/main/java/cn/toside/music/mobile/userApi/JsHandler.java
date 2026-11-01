package cn.toside.music.mobile.userApi;

import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.util.Log;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

public class JsHandler extends Handler {
  private final UtilsEvent utilsEvent;
  // 【改造】事件需要带上 apiId，JS 层据此区分是哪个源（主源 / 备用源）的事件
  private final String apiId;

  JsHandler(Looper looper, UtilsEvent utilsEvent, String apiId) {
    super(looper);
    this.utilsEvent = utilsEvent;
    this.apiId = apiId;
  }

  private void sendInitFailedEvent(String errorMessage) {
    WritableMap params = Arguments.createMap();
    params.putString("action", "init");
    params.putString("apiId", this.apiId);
    params.putString("errorMessage", errorMessage);
    params.putString("data", "{ \"info\": { \"id\": \"" + this.apiId + "\" }, \"status\": false, \"errorMessage\": \"Create JavaScript Env Failed\" }");
    this.utilsEvent.sendEvent(utilsEvent.API_ACTION, params);
    sendLogEvent(new Object[]{"error", errorMessage});
  }

  private void sendLogEvent(Object[] data) {
    WritableMap params = Arguments.createMap();
    params.putString("action", "log");
    params.putString("apiId", this.apiId);
    params.putString("type", (String) data[0]);
    params.putString("log", (String) data[1]);
    this.utilsEvent.sendEvent(utilsEvent.API_ACTION, params);
  }

  private void sendActionEvent(String action, String data) {
    WritableMap params = Arguments.createMap();
    params.putString("action", action);
    params.putString("apiId", this.apiId);
    params.putString("data", data);
    this.utilsEvent.sendEvent(utilsEvent.API_ACTION, params);
  }

  @Override
  public void handleMessage(Message msg) {
    switch (msg.what) {
      case HandlerWhat.INIT_SUCCESS: break;
      case HandlerWhat.INIT_FAILED:
        sendInitFailedEvent((String) msg.obj);
        break;
      case HandlerWhat.ACTION:
        Object[] action = (Object[]) msg.obj;
        sendActionEvent((String) action[0], (String) action[1]);
        // Log.d("UserApi [api call]", "action: " + action[0]);
        break;
      case HandlerWhat.LOG:
        sendLogEvent((Object[]) msg.obj);
        break;
      default:
        Log.w("UserApi [api call]", "Unknown message what: " + msg.what);
        break;
    }
  }
}
