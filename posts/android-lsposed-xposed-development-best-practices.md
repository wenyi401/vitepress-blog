---
title: Android Xposed/LSPosed 开发进阶指南 - 从入门到精通
date: 2026-04-05
tags:
  - Android
  - Xposed
  - LSPosed
  - Hook
  - 系统破解
categories:
  - Android开发
---

# Android Xposed/LSPosed 开发进阶指南

> 本文基于实际项目开发经验，涵盖 Xposed/LSPosed 框架原理、模块开发流程、资源 Hook 限制、通知拦截实现等核心知识点。

## 一、框架对比：Xposed vs LSPosed vs SandHook

| 特性 | Xposed | LSPosed | SandHook |
|------|--------|----------|----------|
| 最低系统版本 | Android 4.0+ | Android 8.0+ | Android 5.0+ |
| Zygisk 支持 | ❌ | ✅ | ❌ |
| Riru 架构 | ✅ | ✅ | ✅ |
| 资源 Hook | ✅ | ⚠️ 仅 Riru | ✅ |
| 隐藏性 | 低 | 高 | 中 |
| 维护状态 | 停止维护 | 活跃 | 活跃 |

### 关键结论

**Zygisk 模式下不支持 `IXposedHookInitPackageResources`**。这是 LSPosed 与传统 Xposed 的最大区别。如果需要资源 Hook，必须使用 Magisk 资源替换模块（如 [R嘴边](https://github.com/LSPosed/R嘴边)）。

## 二、核心 API 详解

### 2.1 IXposedHookLoadPackage

最常用的 Hook 入口，用于拦截应用启动：

```kotlin
class MainHook : IXposedHookLoadPackage {
    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {
        // 判断包名
        if (lpparam.packageName != "com.android.systemui") return
        
        // Hook 方法
        XposedHelpers.findAndHookMethod(
            NotificationListenerService::class.java,
            "onNotificationPosted",
            StatusBarNotification::class.java,
            object : XC_MethodHook() {
                override fun beforeHookedMethod(param: MethodHookParam) {
                    val notification = param.args[0] as StatusBarNotification
                    // 处理通知
                }
            }
        )
    }
}
```

### 2.2 IXposedHookInitPackageResources

资源 Hook 只能在 **Riru 环境**下使用：

```kotlin
class ResourceHook : IXposedHookInitPackageResources {
    override fun initResources(resparam: XC_InitPackageResources.InitPackageResourcesParam) {
        // ⚠️ Zygisk 模式下此接口不会被调用
        if (resparam.packageName != "com.android.systemui") return
        
        // 替换布局资源
        resparam.res.setReplacement(
            "com.android.systemui",
            "layout",
            "status_bar",
            // 返回新的 XML 资源
        )
    }
}
```

### 2.3 常用的 XposedHelpers 方法

```kotlin
// 查找并 Hook 方法
XposedHelpers.findAndHookMethod(
    targetClass,          // 目标类
    methodName,           // 方法名
    parameterTypes,       // 参数类型
    hookCallback         // 回调
)

// 查找构造函数并 Hook
XposedHelpers.findAndHookConstructor(
    targetClass,
    parameterTypes,
    hookCallback
)

// 调用原始方法
param.callOriginalMethod()

// 获取/设置字段
XposedHelpers.getStaticObjectField(...)
XposedHelpers.setStaticIntField(...)
```

## 三、通知拦截实战

### 3.1 NotificationListenerService

Android 14+ 对通知权限做了严格限制：

```kotlin
class DynamicIslandNotificationService : NotificationListenerService() {
    
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        
        // Android 13+ 需要 POST_NOTIFICATIONS 权限
        // Android 14+ 私密通知内容会被过滤
        
        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)
        
        // 过滤规则
        if (shouldFilter(sbn.packageName, title.toString())) {
            return
        }
        
        // 转发给悬浮窗服务
        sendToOverlayService(sbn)
    }
    
    private fun shouldFilter(pkg: String, title: String): Boolean {
        // 过滤系统通知
        if (pkg == "android" || pkg == "com.android.systemui") {
            return true
        }
        return false
    }
}
```

### 3.2 通知数据模型

```kotlin
data class DynamicIslandNotification(
    val packageName: String,
    val title: String,
    val text: String,
    val subText: String? = null,
    val progress: Int? = null,        // 下载进度 0-100
    val isMusic: Boolean = false,      // 是否音乐通知
    val musicState: MusicState? = null
)

data class MusicState(
    val isPlaying: Boolean,
    val artist: String,
    val albumArt: Bitmap? = null
)
```

## 四、悬浮窗服务实现

### 4.1 窗口类型选择

```kotlin
val layoutParams = WindowManager.LayoutParams(
    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, // Android 8+ 必须用这个
    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
    PixelFormat.TRANSLUCENT
)

// 位置：顶部（灵动岛区域）
layoutParams.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
layoutParams.y = 0 // 像素，实际位置由视图自身控制
```

### 4.2 Jetpack Compose 在悬浮窗中使用

```kotlin
class DynamicIslandOverlayService : Service() {
    
    private lateinit var windowManager: WindowManager
    private lateinit var lifecycleRegistry: LifecycleRegistry
    
    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        
        val composeView = ComposeView(this).apply {
            setContent {
                HyperDynamicIsland(
                    viewModel = viewModel,
                    onExpand = { /* 展开动画 */ },
                    onCollapse = { /* 收起动画 */ }
                )
            }
        }
        
        windowManager.addView(composeView, layoutParams)
    }
}
```

## 五、关键限制与解决方案

### 5.1 Zygisk 资源 Hook 限制

**问题**：Zygisk 环境下 `IXposedHookInitPackageResources` 不被调用。

**解决方案**：
1. 使用 Magisk 资源替换模块
2. 纯方法 Hook（`IXposedHookLoadPackage`）
3. 使用 Substrate/Cydia 类似框架

### 5.2 通知内容过滤

**问题**：Android 14+ 私密通知内容在未授权情况下不可见。

**解决方案**：
```kotlin
// 检查是否有访问私密通知的权限
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
    val visibilityOverride = notification.visibility
    if (visibilityOverride == Notification.VISIBILITY_SECRET) {
        // 无法获取内容，只能显示"私密通知"
    }
}
```

### 5.3 前台服务保活

```kotlin
// 必须创建前台通知，否则会被系统杀死
val notification = NotificationCompat.Builder(this, channelId)
    .setContentTitle("灵动岛服务运行中")
    .setSmallIcon(R.drawable.ic_notification)
    .setPriority(NotificationCompat.PRIORITY_LOW)
    .build()

startForeground(NOTIFICATION_ID, notification)
```

## 六、项目架构推荐

```
app/
├── src/main/
│   ├── java/com/example/dynamicisland/
│   │   ├── hook/           # LSPosed Hook 入口
│   │   │   ├── MainHook.kt
│   │   │   └── NotificationHandler.kt
│   │   ├── service/        # 系统服务
│   │   │   ├── NotificationService.kt
│   │   │   └── OverlayService.kt
│   │   ├── ui/             # Compose UI
│   │   │   ├── MainActivity.kt
│   │   │   ├── DynamicIsland.kt
│   │   │   └── components/
│   │   ├── viewmodel/      # MVVM
│   │   ├── data/           # 数据模型
│   │   ├── config/         # 配置管理
│   │   └── di/             # Hilt DI
│   └── AndroidManifest.xml
```

## 七、调试技巧

### 7.1 日志输出

```kotlin
object HookLogger {
    private const val TAG = "DynamicIsland"
    
    fun log(msg: String) {
        XposedBridge.log("[$TAG] $msg")
    }
    
    fun logError(msg: String, t: Throwable? = null) {
        log("[ERROR] $msg")
        t?.let { XposedBridge.log(it) }
    }
}
```

### 7.2 LSPosed 模块配置

```xml
<!-- xposed_module.xml -->
<?xml version="1.0" encoding="utf-8"?>
<modules>
    <module name="com.example.dynamicisland">
        <description>灵动岛模块</description>
        <author>Your Name</author>
        <version>1.0</version>
        
        <!-- LSPosed 作用域 -->
        <cpinfo>
            <CP name="com.android.systemui"/>
        </cpinfo>
        
        <!-- 支持的 LSPosed 版本 -->
        <versions>
            <max version="10999"/>  <!-- 0.0.0+ -->
        </versions>
    </module>
</modules>
```

## 八、总结

1. **资源 Hook**：Zygisk 下不可用，需使用 Riru 或 Magisk 资源模块
2. **通知拦截**：`NotificationListenerService` + `XC_MethodHook` 组合使用
3. **悬浮窗**：`TYPE_APPLICATION_OVERLAY` + Jetpack Compose
4. **权限处理**：Android 13+ 需动态申请通知权限
5. **前台服务**：必须使用 `startForeground` 保活

---

*本文对应的实战项目：[HyperDynamicIsland](https://github.com/wenyi401/DynamicIslandXposed)*
