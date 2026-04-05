---
title: Android LSPosed 模块架构深度解析 - 从设计到打包
date: 2026-04-05
tags: [Android开发, LSPosed, Xposed, 灵动岛, 架构设计]
---

# Android LSPosed 模块架构深度解析

> 本文基于 DynamicIslandXposed 项目实战，深入解析 LSPosed 模块的完整架构设计、通知拦截核心原理、以及生产环境打包配置。

## 目录

1. [整体架构概览](#1-整体架构概览)
2. [核心组件详解](#2-核心组件详解)
3. [通知拦截技术方案](#3-通知拦截技术方案)
4. [进程间通信 (IPC)](#4-进程间通信-ipc)
5. [悬浮窗服务设计](#5-悬浮窗服务设计)
6. [UI 层架构 (MVVM + Compose)](#6-ui-层架构-mvvm--compose)
7. [依赖注入 (Hilt)](#7-依赖注入-hilt)
8. [构建与打包配置](#8-构建与打包配置)
9. [实战 Hook 点分析](#9-实战-hook-点分析)
10. [常见问题与解决方案](#10-常见问题与解决方案)

---

## 1. 整体架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Xposed Module Layer                           │
│                 (运行在目标进程的独立模块)                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────────┐   │
│  │  MainHook   │  │ Notification     │  │  ResourceHook        │   │
│  │  (Legacy)   │  │ InterceptorHook  │  │  (已废弃/Zygisk)    │   │
│  └─────────────┘  └──────────────────┘  └───────────────────────┘   │
│         │                  │                                        │
│         └──────────────────┼──────────────────────────────────────  │
│                            │                                        │
│                     Hook Point APIs                                 │
│              (NotificationPresenter, Row, IconController)            │
├─────────────────────────────────────────────────────────────────────┤
│                    IPC Layer (进程间通信)                            │
│  ┌──────────────────────┐      ┌───────────────────────────────┐   │
│  │  ContentProvider     │      │  BroadcastReceiver            │   │
│  │  (主方案/可靠)       │      │  (备选/进程隔离问题)           │   │
│  └──────────────────────┘      └───────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                       App Process (独立进程)                         │
│  ┌──────────────┐  ┌─────────────────────┐  ┌─────────────────┐   │
│  │ Notification │  │  OverlayService     │  │  MainActivity   │   │
│  │ Listener     │  │  (悬浮窗/TYPE_      │  │  (配置界面)      │   │
│  │ Service      │  │   APPLICATION_      │  │                 │   │
│  │              │  │   OVERLAY)         │  │                 │   │
│  └──────────────┘  └─────────────────────┘  └─────────────────┘   │
│         │                  │                    │                 │
│         └──────────────────┼────────────────────┘                 │
│                            │                                        │
│                   ┌────────▼────────┐                             │
│                   │  ViewModel      │                             │
│                   │  (Hilt DI)      │                             │
│                   └────────┬────────┘                             │
│                            │                                        │
│                   ┌────────▼────────┐                             │
│                   │  Compose UI     │                             │
│                   │  (灵动岛组件)    │                             │
│                   └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

**三层职责:**

| 层级 | 组件 | 职责 |
|------|------|------|
| **Hook Layer** | MainHook, NotificationInterceptorHook | 拦截系统方法，捕获通知事件 |
| **IPC Layer** | ContentProvider, BroadcastReceiver | 跨进程传递通知数据 |
| **App Layer** | NotificationListenerService, OverlayService, MainActivity | 显示配置界面，渲染悬浮窗 |

---

## 2. 核心组件详解

### 2.1 MainHook - 入口类

LSPosed 模块通过 `assets/xposed_init` 文件指定入口类:

```
com.example.dynamicislandxposed.hook.MainHook
com.example.dynamicislandxposed.hook.NotificationInterceptorHook
```

```kotlin
class MainHook : IXposedHookLoadPackage {
    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {
        when (lpparam.packageName) {
            "com.android.systemui" -> hookSystemUI(lpparam)
            "com.miui.systemui" -> hookMiuiSystemUI(lpparam)
        }
    }
}
```

**核心 API:**

| 接口 | 时机 | 用途 |
|------|------|------|
| `IXposedHookLoadPackage` | 应用加载时 | Hook Java 方法 |
| `IXposedHookInitPackageResources` | 资源初始化时 | 修改布局/图片 (Riru only) |
| `IXposedHookZygoteInit` | Zygote 启动时 | 系统级 Hook |

### 2.2 NotificationInterceptorHook - 通知拦截核心

这是最关键的 Hook 类，负责在 SystemUI 进程中捕获所有通知事件:

```kotlin
class NotificationInterceptorHook : IXposedHookLoadPackage {
    
    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {
        when (lpparam.packageName) {
            "com.android.systemui" -> hookSystemUINotification(lpparam)
        }
    }
    
    private fun hookSystemUINotification(lpparam: XC_LoadPackage.LoadPackageParam) {
        // 1. NotificationInterceptorService (Android 12+)
        hookNotificationInterceptorService(lpparam)
        // 2. NotificationPresenter
        hookNotificationPresenter(lpparam)
        // 3. NotificationStackScrollLayout
        hookNotificationStackLayout(lpparam)
        // 4. ExpandableNotificationRow
        hookExpandableNotificationRow(lpparam)
    }
}
```

**Android 版本差异处理:**

```kotlin
private fun hookNotificationInterceptorService(lpparam: XC_LoadPackage.LoadPackageParam) {
    val classNames = listOf(
        // Android 12+
        "com.android.systemui.statusbar.notification.NotificationInterceptorService",
        // Android 13+
        "com.android.systemui.statusbar.notification.collection.NotificationService"
    )
    
    for (className in classNames) {
        try {
            val clazz = XposedHelpers.findClass(className, lpparam.classLoader)
            // Hook onNotificationPosted 和 onNotificationRemoved
            XposedBridge.hookAllMethods(clazz, "onNotificationPosted", ...)
            break
        } catch (e: Throwable) {
            // 类不存在，尝试下一个
        }
    }
}
```

---

## 3. 通知拦截技术方案

### 3.1 方案对比

| 方案 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| **NotificationListenerService** | 系统服务，监听所有通知 | 简单可靠，无需 Hook | 需要用户授权 |
| **Xposed Hook** | Hook 通知处理方法 | 可拦截更多事件 | 需要 Root/LSPosed |
| **混用方案** | 两者结合 | 互补优势 | 复杂度高 |

**推荐: 混用方案**

- `NotificationListenerService` 负责通知数据提取和基础过滤
- `NotificationInterceptorHook` 负责捕获用户交互事件（点击、展开等）

### 3.2 NotificationHandler - 通知过滤与优先级

```kotlin
@Singleton
class NotificationHandler @Inject constructor(
    @ApplicationContext private val context: Context
) {
    
    // 高优先级应用
    private val PRIORITY_PACKAGES = setOf(
        "com.tencent.mm",    // 微信
        "com.tencent.mobileqq",
        "com.alibaba.android.rim",
        "com.sg.movie"       // 哔哩哔哩
    )
    
    // 音乐应用
    private val MUSIC_PACKAGES = setOf(
        "com.tencent.qqmusic",
        "com.netease.cloudmusic"
    )
    
    fun shouldShowInIsland(sbn: StatusBarNotification): Boolean {
        // 1. 排除系统黑名单
        if (SYSTEM_BLACKLIST.contains(sbn.packageName)) return false
        // 2. 排除游戏
        if (isGamePackage(sbn.packageName)) return false
        // 3. 检查重要性
        if (!hasSufficientImportance(sbn)) return false
        return true
    }
    
    fun getNotificationPriority(sbn: StatusBarNotification): Int {
        var priority = 50
        // 音乐通知最高
        if (isMusicNotification(sbn)) return 100
        // 来电/通话
        if (sbn.notification.category == Notification.CATEGORY_CALL) return 95
        // 下载进度
        if (isDownloadNotification(sbn)) return 90
        // IM 应用
        if (PRIORITY_PACKAGES.contains(sbn.packageName)) priority = 80
        return priority.coerceIn(0, 100)
    }
    
    fun extractNotificationInfo(sbn: StatusBarNotification): NotificationInfo {
        return NotificationInfo(
            key = sbn.key,
            packageName = sbn.packageName,
            title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: "",
            text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: "",
            isMusic = isMusicNotification(sbn),
            isDownload = isDownloadNotification(sbn),
            progress = extractProgress(sbn),
            mediaInfo = extractMediaInfo(sbn)
        )
    }
}
```

---

## 4. 进程间通信 (IPC)

### 4.1 三种 IPC 方案对比

| 方案 | 可靠性 | 延迟 | 适用场景 |
|------|--------|------|----------|
| **BroadcastReceiver** | ⚠️ Zygisk 进程隔离问题 | 低 | 简单事件 |
| **ContentProvider** | ✅ 推荐 | 低 | 结构化数据 |
| **Xposed Service API** | ✅ Modern API | 低 | 2024+ 现代模块 |

### 4.2 ContentProvider 实现

```kotlin
class DynamicIslandContentProvider : ContentProvider() {
    
    companion object {
        const val AUTHORITY = "com.example.dynamicislandxposed.provider"
        val URI_NOTIFICATION: Uri = Uri.parse("content://$AUTHORITY/notification")
        
        // 跨进程状态
        private val _currentNotification = MutableStateFlow<NotificationData?>(null)
        val currentNotification: StateFlow<NotificationData?> = _currentNotification.asStateFlow()
    }
    
    override fun query(uri: Uri, ...): Cursor? {
        return when (uriMatcher.match(uri)) {
            CODE_NOTIFICATION -> queryNotification()
            else -> null
        }
    }
    
    override fun update(uri: Uri, values: ContentValues?, ...): Int {
        when (uriMatcher.match(uri)) {
            CODE_NOTIFICATION -> {
                val data = NotificationData(
                    key = values.getAsString(COL_KEY) ?: return 0,
                    title = values.getAsString(COL_TITLE) ?: "",
                    // ...
                )
                _currentNotification.value = data
                context?.contentResolver?.notifyChange(uri, null)
                return 1
            }
        }
        return 0
    }
}
```

### 4.3 通信流程

```
NotificationListenerService (应用进程)
        │
        │ onNotificationPosted(sbn)
        ▼
NotificationHandler.extractNotificationInfo()
        │
        │ sendNotificationViaContentProvider(info)
        ▼
ContentProvider.update(URI_NOTIFICATION, values)
        │
        │ notifyChange()
        ▼
OverlayService (应用进程)
        │
        │ query(URI_NOTIFICATION)
        ▼
ViewModel.showNotification()
        │
        ▼
Compose UI 渲染
```

---

## 5. 悬浮窗服务设计

### 5.1 Service 多接口实现

`DynamicIslandOverlayService` 需要同时实现多个接口才能在 Service 中使用 ViewModel:

```kotlin
@AndroidEntryPoint
class DynamicIslandOverlayService : Service(), 
    LifecycleOwner, 
    SavedStateRegistryOwner, 
    ViewModelStoreOwner {
    
    private lateinit var lifecycleRegistry: LifecycleRegistry
    private lateinit var savedStateRegistryController: SavedStateRegistryController
    private val vmStore = ViewModelStore()
    
    override val lifecycle: Lifecycle
        get() = lifecycleRegistry
    
    override val savedStateRegistry: SavedStateRegistry
        get() = savedStateRegistryController.savedStateRegistry
    
    override val viewModelStore: ViewModelStore
        get() = vmStore
}
```

### 5.2 WindowManager 配置

```kotlin
private fun attachToWindow() {
    val layoutParams = WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,  // Android 8+ 推荐
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT
    ).apply {
        gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        y = getStatusBarHeight() + 8  // 状态栏高度 + 间距
    }
    
    windowManager.addView(composeView, layoutParams)
}
```

### 5.3 前台服务通知

```kotlin
private fun createNotificationChannel() {
    val channel = NotificationChannel(
        CHANNEL_ID,
        "灵动岛服务",
        NotificationManager.IMPORTANCE_LOW
    ).apply {
        description = "灵动岛悬浮窗服务运行中"
        setShowBadge(false)
    }
    notificationManager.createNotificationChannel(channel)
}

private fun createNotification(): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("Hyper灵动岛")
        .setContentText("正在运行中...")
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setOngoing(true)
        .build()
}
```

---

## 6. UI 层架构 (MVVM + Compose)

### 6.1 状态模型

```kotlin
sealed class DynamicIslandState {
    data object Hidden : DynamicIslandState()
    data object Compact : DynamicIslandState()   // 紧凑状态
    data object Expanded : DynamicIslandState()  // 展开状态
    data object Minimal : DynamicIslandState()    // 极小状态
}

data class DynamicIslandUiState(
    val state: DynamicIslandState = DynamicIslandState.Hidden,
    val notification: DynamicIslandNotification? = null,
    val progress: Float = 0f,        // 下载进度 0~1
    val isMusicPlaying: Boolean = false,
    val musicInfo: MusicInfo? = null
)

data class DynamicIslandNotification(
    val id: String,
    val packageName: String,
    val title: String,
    val text: String,
    val icon: Icon?,
    val timestamp: Long,
    val isOngoing: Boolean = false
)
```

### 6.2 ViewModel 设计

```kotlin
@HiltViewModel
class DynamicIslandViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(DynamicIslandUiState())
    val uiState: StateFlow<DynamicIslandUiState> = _uiState.asStateFlow()
    
    fun showNotification(notification: DynamicIslandNotification) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    state = DynamicIslandState.Compact,
                    notification = notification
                )
            }
            saveState()
        }
    }
    
    fun expand() = viewModelScope.launch {
        _uiState.update { it.copy(state = DynamicIslandState.Expanded) }
    }
    
    fun collapse() = viewModelScope.launch {
        _uiState.update { it.copy(state = DynamicIslandState.Compact) }
    }
    
    fun hide() = viewModelScope.launch {
        _uiState.update { 
            it.copy(state = DynamicIslandState.Hidden, notification = null) 
        }
        savedStateHandle.remove<NotificationData>("notification")
    }
}
```

### 6.3 Compose UI

```kotlin
@Composable
fun HyperDynamicIsland(
    uiState: DynamicIslandUiState,
    onExpand: () -> Unit,
    onCollapse: () -> Unit,
    onClear: () -> Unit
) {
    val transition = updateTransition(uiState.state, label = "island")
    
    val width by transition.animateDp(
        transitionSpec = { spring(stiffness = Spring.StiffnessLow) },
        label = "width"
    ) { state ->
        when (state) {
            DynamicIslandState.Expanded -> 300.dp
            DynamicIslandState.Compact -> 120.dp
            DynamicIslandState.Minimal -> 60.dp
            DynamicIslandState.Hidden -> 0.dp
        }
    }
    
    val cornerRadius by transition.animateDp(
        transitionSpec = { spring(stiffness = Spring.StiffnessMedium) },
        label = "cornerRadius"
    ) { state ->
        when (state) {
            DynamicIslandState.Expanded -> 24.dp
            else -> 17.dp
        }
    }
    
    AnimatedVisibility(
        visible = uiState.state != DynamicIslandState.Hidden,
        enter = fadeIn() + scaleIn(),
        exit = fadeOut() + scaleOut()
    ) {
        Box(
            modifier = Modifier
                .width(width)
                .height(35.dp)
                .background(Color.Black, RoundedCornerShape(cornerRadius))
                .clickable { 
                    when (uiState.state) {
                        DynamicIslandState.Compact -> onExpand()
                        DynamicIslandState.Expanded -> onCollapse()
                        else -> {}
                    }
                }
        ) {
            when {
                uiState.isMusicPlaying -> MusicContent(uiState.musicInfo)
                uiState.progress > 0 -> ProgressContent(uiState.progress)
                uiState.notification != null -> NotificationContent(uiState.notification)
            }
        }
    }
}
```

---

## 7. 依赖注入 (Hilt)

### 7.1 Application 级注入

```kotlin
@HiltAndroidApp
class DynamicIslandApp : Application()
```

### 7.2 Service 级注入

```kotlin
@AndroidEntryPoint
class DynamicIslandNotificationService : NotificationListenerService() {
    
    @Inject
    lateinit var notificationHandler: NotificationHandler
    // Hilt 自动注入
}
```

### 7.3 Module 配置

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    
    @Provides
    @Singleton
    fun provideNotificationHandler(
        @ApplicationContext context: Context
    ): NotificationHandler {
        return NotificationHandler(context)
    }
    
    @Provides
    @Singleton
    fun provideModuleConfig(
        @ApplicationContext context: Context
    ): ModuleConfig {
        return ModuleConfig.getInstance(context)
    }
}
```

---

## 8. 构建与打包配置

### 8.1 build.gradle.kts

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.example.dynamicislandxposed"
    compileSdk = 35
    
    defaultConfig {
        applicationId = "com.example.dynamicislandxposed"
        minSdk = 30  // Android 11+
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
    
    signingConfigs {
        create("release") {
            // 从 keystore.properties 读取
            val props = file("keystore.properties").takeIf { it.exists() }?.let {
                java.util.Properties().apply { it.inputStream().use { s -> load(s) } }
            }
            props?.let {
                storeFile = file(it["storeFile"] as String)
                storePassword = it["storePassword"] as String
                keyAlias = it["keyAlias"] as String
                keyPassword = it["keyPassword"] as String
            }
        }
    }
    
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            isMinifyEnabled = false
            isDebuggable = true
        }
    }
}

dependencies {
    // Xposed API - 仅编译时不打包
    compileOnly("de.robv.android.xposed:api:82")
}
```

### 8.2 AndroidManifest.xml 核心配置

```xml
<application
    android:name=".DynamicIslandApp"
    android:allowBackup="true">

    <!-- Xposed 模块元数据 -->
    <meta-data
        android:name="xposedmodule"
        android:value="true" />
    <meta-data
        android:name="xposeddescription"
        android:value="HyperOS 灵动岛增强模块" />
    <meta-data
        android:name="xposedminversion"
        android:value="82" />
    <meta-data
        android:name="xposedscope"
        android:resource="@array/xposed_scope" />

    <!-- 通知监听服务 -->
    <service
        android:name=".service.DynamicIslandNotificationService"
        android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
        android:exported="true">
        <intent-filter>
            <action android:name="android.service.notification.NotificationListenerService" />
        </intent-filter>
    </service>

    <!-- 悬浮窗前台服务 -->
    <service
        android:name=".service.DynamicIslandOverlayService"
        android:foregroundServiceType="specialUse"
        android:exported="false" />

    <!-- IPC -->
    <provider
        android:name=".ipc.DynamicIslandContentProvider"
        android:authorities="com.example.dynamicislandxposed.provider"
        android:exported="false" />
</application>
```

### 8.3 作用域配置 (xposed_scope)

```xml
<resources>
    <string-array name="xposed_scope">
        <item>com.android.systemui</item>      <!-- AOSP -->
        <item>com.miui.systemui</item>          <!-- MIUI/HyperOS -->
        <item>com.xiaomi.misettings</item>     <!-- 小米设置 -->
    </string-array>
</resources>
```

---

## 9. 实战 Hook 点分析

### 9.1 Android 版本差异

不同 Android 版本的 SystemUI 通知处理类名不同:

| 版本 | NotificationInterceptor | NotificationPresenter |
|------|------------------------|----------------------|
| Android 12 | `NotificationInterceptorService` | `StatusBarNotificationPresenter` |
| Android 13+ | `NotificationService` | `NotificationPresenter` |
| Android 14 | `NotificationServiceImpl` | `NotificationPresenter` |

### 9.2 推荐的 Hook 策略

```kotlin
private fun hookWithFallback(
    classNames: List<String>,
    classLoader: ClassLoader,
    methodName: String,
    callback: XC_MethodHook
) {
    for (className in classNames) {
        try {
            val clazz = XposedHelpers.findClass(className, classLoader)
            XposedBridge.hookAllMethods(clazz, methodName, callback)
            HookLogger.logHookSuccess(className, methodName)
            return
        } catch (e: Throwable) {
            // 继续尝试下一个
        }
    }
    HookLogger.log("All classes failed for: $methodName")
}
```

### 9.3 关键 Hook 方法速查

| 目标类 | 方法 | 触发时机 |
|--------|------|----------|
| `NotificationInterceptorService` | `onNotificationPosted` | 新通知到达 |
| `NotificationInterceptorService` | `onNotificationRemoved` | 通知被移除 |
| `NotificationPresenter` | `setHeadsUp` | 浮动通知 |
| `NotificationPresenter` | `onNotificationClick` | 通知点击 |
| `ExpandableNotificationRow` | `setExpanded` | 展开/收起 |
| `StatusBarIconController` | `setIcon` | 状态栏图标更新 |

---

## 10. 常见问题与解决方案

### Q1: 模块不生效？

```bash
# 1. 确认模块已启用
adb shell "ls /data/adb/lspd/modules"

# 2. 检查 SELinux 状态
adb shell getenforce
# 需要 Permissive

# 3. 查看 LSPosed 日志
adb logcat -s LSPosed

# 4. 重启 SystemUI
adb shell killall com.android.systemui
```

### Q2: Hook 类找不到？

```kotlin
// Android 版本差异处理
val classNames = listOf(
    "com.android.systemui.xxx.v1.ClassName",
    "com.android.systemui.xxx.v2.ClassName",
    "com.android.systemui.xxx.ClassName"  // 最新版
)

for (className in classNames) {
    try {
        val clazz = XposedHelpers.findClass(className, lpparam.classLoader)
        // Found!
        break
    } catch (e: ClassNotFoundError) {
        continue
    }
}
```

### Q3: Zygisk 环境下 IPC 失效？

**原因**: 模块进程与 Hook 进程隔离

**解决方案**: 
1. 优先使用 ContentProvider（ContentProvider 在模块进程内）
2. 广播发送到模块进程而非 Hook 进程
3. 使用 Xposed Service API (Modern API)

### Q4: 悬浮窗不显示？

```kotlin
// 1. 检查权限
if (!Settings.canDrawOverlays(context)) {
    // 请求 SYSTEM_ALERT_WINDOW 权限
}

// 2. 检查通知监听权限
val nls = NotificationManagerCompat.getEnabledListenerPackages(context)
if (!nls.contains(context.packageName)) {
    // 请求通知监听权限
}
```

### Q5: Compose 动画卡顿？

```kotlin
// 使用 remember + 避免重组
val transition = remember { 
    updateTransition(targetState, label = "island") 
}

// 避免在动画中创建对象
val animationSpec = remember { spring(stiffness = Spring.StiffnessLow) }
```

---

## 总结

LSPosed 模块开发的核心要点:

1. **架构分层**: Hook 层 → IPC 层 → App 层，清晰分离
2. **版本兼容**: 多种类名 fallback 策略处理 Android 版本差异
3. **IPC 可靠**: ContentProvider 为主方案，广播为备选
4. **状态管理**: MVVM + StateFlow，Compose 动画流畅
5. **权限完整**: 悬浮窗 + 通知监听 + 前台服务缺一不可

---

*本文源码: [DynamicIslandXposed](https://github.com/wenyi401/DynamicIslandXposed)*

*参考项目: [HyperCeiler](https://github.com/ReChronoRain/HyperCeiler), [HyperIsland](https://github.com/1812z/HyperIsland)*
