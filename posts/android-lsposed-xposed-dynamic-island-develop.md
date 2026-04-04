---
title: Android Lsposed + 灵动岛开发完全指南
date: 2026-04-04 23:00:00
tags: [Android开发, LSPosed, Xposed, 灵动岛, Jetpack Compose]
---

# Android Lsposed + 灵动岛开发完全指南

## 前言

本文是 HyperDynamicIsland 项目的学习笔记，涵盖从 Xposed/LSPosed 框架原理到完整 Android 灵动岛模块开发的全部知识体系。

---

## 一、Xposed / LSPosed 框架原理

### 1.1 Xposed 是什么

Xposed 是一个针对 Android 系统的 Hook 框架，允许开发者通过劫持（Hook）系统或应用的函数来修改其行为，无需修改原始 APK。

**核心能力：**
- 数据劫持：拦截并修改方法返回值
- 参数修改：在方法执行前改变输入参数
- 主动调用：绕过限制调用私有方法
- 行为拦截：在特定时机插入自定义逻辑

### 1.2 Xposed 实现原理

```
┌─────────────────────────────────────────────────────┐
│  标准 Android 启动流程                               │
│  Zygote ──fork──> app_process ──> Application      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Xposed 启动流程                                     │
│  Zygote ──fork──> Xposed app_process (定制版)       │
│                 ├── 加载 XposedBridge.jar           │
│                 └── 执行 XposedBridge.main()        │
│                      ├── Hook ZygoteInit.main()   │
│                      └── 劫持所有 Zygote 子进程     │
└─────────────────────────────────────────────────────┘
```

Xposed 框架替换了系统原始的 `app_process`，使用自定义版本启动 Zygote 进程，并加载 `XposedBridge.jar`。通过 Hook `ZygoteInit.main()` 实现对所有应用进程的拦截。

### 1.3 框架发展对比

| 特性 | Xposed | EdXposed | LSPosed |
|------|--------|----------|---------|
| Android 版本 | 4.0 - 8.1 | 8.0 - 11 | 8.1 - 15+ |
| 注入方式 | 替换 app_process | Riru 动态注入 | Zygisk 集成 |
| 生效方式 | 全局生效 | 全局生效 | 作用域隔离 |
| 重启需求 | 重启系统 | 重启系统 | 仅重启应用 |
| 抗检测 | 低 | 中 | 高 |

**为什么选择 LSPosed？**
- **Zygisk 集成**：直接集成到 Zygote 进程中，更隐蔽
- **作用域隔离**：白名单机制，只对指定应用生效
- **模块隔离**：不同模块互不冲突，可同时运行
- **高版本支持**：支持最新 Android 系统

---

## 二、LSPosed 模块开发环境

### 2.1 开发环境要求

- Android Studio Hedgehog (2023.1.1) 或更高
- JDK 17
- Android SDK 35 (Compile SDK)
- Min SDK 30 (Android 11+，灵动岛需要)
- 一台已 Root 并安装 LSPosed 的 Android 设备

### 2.2 项目创建与依赖

**settings.gradle.kts**
```kotlin
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://api.xposed.info/") }
    }
}
```

**app/build.gradle.kts 关键依赖**
```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
    id("org.jetbrains.kotlin.plugin.compose")
}

dependencies {
    // Xposed API 仅编译时使用，不打包进 APK
    compileOnly("de.robv.android.xposed:api:82")
    
    // Jetpack Compose
    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    
    // Hilt 依赖注入
    implementation("com.google.dagger:hilt-android:2.56")
    ksp("com.google.dagger:hilt-android-compiler:2.56")
}
```

### 2.3 AndroidManifest.xml 配置

```xml
<application>
    <!-- 声明本应用是 Xposed 模块 -->
    <meta-data
        android:name="xposedmodule"
        android:value="true" />
    
    <!-- 模块描述 -->
    <meta-data
        android:name="xposeddescription"
        android:value="HyperDynamicIsland 灵动岛增强模块" />
    
    <!-- 最低 Xposed 版本 -->
    <meta-data
        android:name="xposedminversion"
        android:value="52" />
</application>
```

### 2.4 xposed_init 配置

在 `src/main/assets/` 目录下创建 `xposed_init` 文件，内容为 Hook 类的全路径：

```
com.example.dynamicislandxposed.hook.MainHook
```

---

## 三、Hook 核心机制

### 3.1 IXposedHookLoadPackage 接口

所有 LSPosed 模块的入口必须实现 `IXposedHookLoadPackage` 接口：

```kotlin
class MainHook : IXposedHookLoadPackage {
    
    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {
        // lpparam 包含被加载应用的上下文信息
        when (lpparam.packageName) {
            "com.android.systemui" -> hookSystemUI(lpparam)
            "com.miui.systemui" -> hookMiuiSystemUI(lpparam)
        }
    }
}
```

**XC_LoadPackage.LoadPackageParam 核心字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| packageName | String | 应用包名 |
| processName | String | 进程名 |
| classLoader | ClassLoader | 应用的类加载器 |
| appInfo | ApplicationInfo | 应用信息 |
| isFirstApplication | Boolean | 是否首次加载 |

### 3.2 常用 Hook 方法

**findAndHookMethod - Hook 类方法**

```kotlin
// Hook 构造函数
XposedHelpers.findAndHookConstructor(
    "com.example.target.ClassName",
    lpparam.classLoader,
    android.content.Context::class.java,
    object : XC_MethodHook() {
        override fun afterHookedMethod(param: MethodHookParam) {
            // 在构造方法执行后获取实例
            val instance = param.thisObject as View
        }
    }
)

// Hook 普通方法
XposedHelpers.findAndHookMethod(
    "com.example.target.ClassName",
    lpparam.classLoader,
    "methodName",
    String::class.java,  // 参数类型
    Int::class.java,
    object : XC_MethodHook() {
        override fun beforeHookedMethod(param: MethodHookParam) {
            // 方法执行前修改参数
            param.args[0] = "modified"
        }
        
        override fun afterHookedMethod(param: MethodHookParam) {
            // 方法执行后修改返回值
            param.result = "modified result"
        }
    }
)
```

**hookAllMethods - Hook 所有同名重载方法**

```kotlin
val targetClass = XposedHelpers.findClass("com.example.Target", lpparam.classLoader)
XposedBridge.hookAllMethods(targetClass, "onClick", object : XC_MethodHook() {
    override fun beforeHookedMethod(param: MethodHookParam) {
        XposedBridge.log("Button clicked!")
    }
})
```

### 3.3 Hook 时机详解

```
beforeHookedMethod(param)
    │
    ▼
  原方法执行
    │
    ▼
afterHookedMethod(param)
```

- **beforeHookedMethod**：原方法执行前调用，可修改 `param.args`
- **afterHookedMethod**：原方法执行后调用，可修改 `param.result`

```kotlin
XposedHelpers.findAndHookMethod(
    "com.example.Class",
    lpparam.classLoader,
    "getValue",
    object : XC_MethodHook() {
        // 原方法执行前
        override fun beforeHookedMethod(param: MethodHookParam) {
            val arg = param.args[0] as String
            XposedBridge.log("getValue called with: $arg")
        }
        
        // 原方法执行后
        override fun afterHookedMethod(param: MethodHookParam) {
            val original = param.result as String
            XposedBridge.log("getValue returned: $original")
            // 修改返回值
            param.result = "[Modified] $original"
        }
    }
)
```

---

## 四、LSPosed 典型 Hook 场景

### 4.1 Hook SystemUI 通知面板

```kotlin
private fun hookNotificationPanel(lpparam: XC_LoadPackage.LoadPackageParam) {
    val panelClassNames = listOf(
        "com.android.systemui.statusbar.phone.NotificationPanelView",
        "com.android.systemui.statusbar.phone.NotificationPanelViewController"
    )
    
    for (className in panelClassNames) {
        try {
            val panelClass = XposedHelpers.findClass(className, lpparam.classLoader)
            
            // Hook 通知点击
            XposedBridge.hookAllMethods(panelClass, "onNotificationClicked", object : XC_MethodHook() {
                override fun beforeHookedMethod(param: MethodHookParam) {
                    XposedBridge.log("通知被点击")
                }
            })
            
            break
        } catch (e: Throwable) {
            // 类不存在，尝试下一个
        }
    }
}
```

### 4.2 Hook 通知行 ExpandableNotificationRow

```kotlin
private fun hookNotificationRow(lpparam: XC_LoadPackage.LoadPackageParam) {
    try {
        val rowClass = XposedHelpers.findClass(
            "com.android.systemui.statusbar.notification.row.ExpandableNotificationRow",
            lpparam.classLoader
        )
        
        // Hook 展开状态变化
        XposedBridge.hookAllMethods(rowClass, "setExpanded", object : XC_MethodHook() {
            override fun beforeHookedMethod(param: MethodHookParam) {
                val isExpanded = param.args.getOrNull(0) as? Boolean ?: false
                if (isExpanded) {
                    XposedBridge.log("通知展开")
                }
            }
        })
    } catch (e: Throwable) {
        XposedBridge.log("ExpandableNotificationRow Hook 失败: ${e.message}")
    }
}
```

### 4.3 Hook MIUI/HyperOS 灵动岛类

```kotlin
private fun hookMiuiDynamicIsland(lpparam: XC_LoadPackage.LoadPackageParam) {
    val islandClassNames = listOf(
        "com.miui.systemui.dynamicIsland.MiuiDynamicIsland",
        "com.miui.systemui.dynamicIsland.util.MiuiDynamicIslandHelper"
    )
    
    for (className in islandClassNames) {
        try {
            val islandClass = XposedHelpers.findClass(className, lpparam.classLoader)
            
            XposedBridge.hookAllMethods(islandClass, "show", object : XC_MethodHook() {
                override fun afterHookedMethod(param: MethodHookParam) {
                    XposedBridge.log("MIUI 灵动岛显示")
                }
            })
            
            XposedBridge.hookAllMethods(islandClass, "hide", object : XC_MethodHook() {
                override fun afterHookedMethod(param: MethodHookParam) {
                    XposedBridge.log("MIUI 灵动岛隐藏")
                }
            })
            
            break
        } catch (e: Throwable) {
            // 类不存在
        }
    }
}
```

---

## 五、NotificationListenerService 通知拦截

### 5.1 服务注册

在 AndroidManifest.xml 中注册服务：

```xml
<service
    android:name=".service.DynamicIslandNotificationService"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
    android:exported="false" />
</service>
```

### 5.2 通知监听实现

```kotlin
class DynamicIslandNotificationService : NotificationListenerService() {
    
    companion object {
        private val _currentNotification = MutableStateFlow<DynamicIslandNotification?>(null)
        val currentNotification: StateFlow<DynamicIslandNotification?> = _currentNotification.asStateFlow()
    }
    
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        
        if (shouldShowInIsland(sbn)) {
            val notification = sbn.toDynamicIslandNotification()
            _currentNotification.value = notification
            
            // 通知悬浮窗服务
            DynamicIslandOverlayService.updateNotification(notification)
        }
        
        super.onNotificationPosted(sbn)
    }
    
    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        sbn ?: return
        // 处理通知移除逻辑
        super.onNotificationRemoved(sbn)
    }
}
```

### 5.3 权限请求

用户需要在系统设置中授权通知访问权限：
> 设置 → 通知 → 通知使用权 → 选择你的模块

---

## 六、悬浮窗服务实现灵动岛 UI

### 6.1 TYPE_APPLICATION_OVERLAY

Android 8.0+ 使用 `TYPE_APPLICATION_OVERLAY` 显示悬浮窗：

```kotlin
val layoutParams = WindowManager.LayoutParams(
    WindowManager.LayoutParams.WRAP_CONTENT,
    WindowManager.LayoutParams.WRAP_CONTENT,
    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
    PixelFormat.TRANSLUCENT
).apply {
    gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
    y = statusBarHeight + 8
}

windowManager.addView(composeView, layoutParams)
```

### 6.2 前台服务保活

```kotlin
class DynamicIslandOverlayService : Service() {
    
    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "dynamic_island_service"
        
        fun start(context: Context) {
            context.startForegroundService(Intent(context, DynamicIslandOverlayService::class.java))
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
    }
    
    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "灵动岛服务",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "保持灵动岛服务运行"
            setShowBadge(false)
        }
        val notificationManager = getSystemService(NotificationManager::class.java)
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
}
```

### 6.3 Jetpack Compose 灵动岛 UI

```kotlin
@Composable
fun HyperDynamicIsland(
    uiState: DynamicIslandUiState,
    onExpand: () -> Unit,
    onCollapse: () -> Unit,
    onClear: () -> Unit
) {
    Box(
        modifier = Modifier
            .padding(8.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(Color.Black)
            .clickable { onExpand() }
    ) {
        when (uiState.state) {
            DynamicIslandState.Compact -> {
                // 紧凑形态：只显示图标
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Image(
                        painter = rememberAsyncImagePainter(uiState.notification?.icon),
                        contentDescription = null,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
            
            DynamicIslandState.Expanded -> {
                // 展开形态：显示更多信息
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = uiState.notification?.title ?: "",
                        color = Color.White,
                        fontSize = 14.sp
                    )
                    Text(
                        text = uiState.notification?.text ?: "",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 12.sp
                    )
                }
            }
            
            DynamicIslandState.Hidden -> {
                // 隐藏
            }
        }
    }
}
```

---

## 七、项目架构设计

### 7.1 整体架构

```
┌──────────────────────────────────────────────────────┐
│                   HyperDynamicIsland                  │
├──────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────┐ │
│  │  LSPosed Hook   │───▶│  NotificationListener   │ │
│  │  (SystemUI)     │    │       Service           │ │
│  └─────────────────┘    └───────────┬─────────────┘ │
│                                      │               │
│                                      ▼               │
│                           ┌─────────────────────────┐│
│                           │  Overlay Service        ││
│                           │  (悬浮窗 + Compose UI)   ││
│                           └───────────┬─────────────┘│
│                                       │               │
│                                       ▼               │
│                           ┌─────────────────────────┐│
│                           │     ViewModel           ││
│                           │  (状态管理 + 业务逻辑)   ││
│                           └─────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### 7.2 目录结构

```
app/src/main/java/com/example/dynamicislandxposed/
├── DynamicIslandApp.kt          # Application 类
├── hook/                        # LSPosed Hook 逻辑
│   ├── MainHook.kt             # 主入口
│   ├── NotificationHandler.kt   # 通知拦截处理
│   ├── ResourceHook.kt          # 资源 Hook
│   └── HookLogger.kt            # 日志工具
├── ui/                          # Compose UI
│   ├── MainActivity.kt         # 配置页面
│   ├── DynamicIslandUi.kt      # 灵动岛主 UI
│   ├── DynamicIslandAnimations.kt
│   └── theme/Theme.kt
├── service/                     # 系统服务
│   ├── DynamicIslandNotificationService.kt
│   └── DynamicIslandOverlayService.kt
├── viewmodel/                   # MVVM
│   └── DynamicIslandViewModel.kt
├── data/                        # 数据模型
│   └── DynamicIslandData.kt
├── config/                      # 配置管理
│   └── ModuleConfig.kt
└── di/                          # Hilt 依赖注入
    └── AppModule.kt
```

### 7.3 状态管理模式

```kotlin
// 核心状态
data class DynamicIslandUiState(
    val state: DynamicIslandState = DynamicIslandState.Hidden,
    val notification: DynamicIslandNotification? = null,
    val progress: Float = 0f,
    val isMusicPlaying: Boolean = false,
    val musicInfo: MusicInfo? = null
)

sealed class DynamicIslandState {
    data object Hidden : DynamicIslandState()    // 隐藏
    data object Compact : DynamicIslandState()   // 紧凑（单点）
    data object Expanded : DynamicIslandState()  // 展开（长条）
    data object Minimal : DynamicIslandState()    // 最小化（音乐）
}

// ViewModel 状态更新
class DynamicIslandViewModel : ViewModel() {
    
    private val _uiState = MutableStateFlow(DynamicIslandUiState())
    val uiState: StateFlow<DynamicIslandUiState> = _uiState.asStateFlow()
    
    fun showNotification(notification: DynamicIslandNotification) {
        _uiState.update { it.copy(
            state = DynamicIslandState.Compact,
            notification = notification
        )}
    }
    
    fun expand() {
        _uiState.update { it.copy(state = DynamicIslandState.Expanded) }
    }
    
    fun collapse() {
        _uiState.update { it.copy(state = DynamicIslandState.Compact) }
    }
    
    fun clearNotification() {
        _uiState.update { it.copy(
            state = DynamicIslandState.Hidden,
            notification = null
        )}
    }
}
```

---

## 八、关键 Hook 点详解

### 8.1 通知优先级判断

```kotlin
private fun getPriority(notification: DynamicIslandNotification): Int {
    var priority = 0
    
    // 正在进行的通知优先级最高 (+100)
    if (notification.isOngoing) {
        priority += 100
    }
    
    // 高优先级应用 (+50)
    if (PRIORITY_PACKAGES.contains(notification.packageName)) {
        priority += 50
    }
    
    // 音乐应用 (+30)
    if (MUSIC_PACKAGES.contains(notification.packageName)) {
        priority += 30
    }
    
    // 下载应用 (+20)
    if (DOWNLOAD_PACKAGES.contains(notification.packageName)) {
        priority += 20
    }
    
    return priority
}
```

### 8.2 应用过滤黑名单

```kotlin
private val EXCLUDED_PACKAGES = setOf(
    "com.android.systemui",      // 系统 UI
    "com.android.launcher",       // 桌面
    "com.miui.home",             // MIUI 桌面
    "com.miui.systemui.provider"  // MIUI 系统 UI 提供者
)

// 过滤逻辑
private fun shouldShowInIsland(sbn: StatusBarNotification): Boolean {
    val packageName = sbn.packageName
    
    if (packageName in EXCLUDED_PACKAGES) return false
    if (packageName.contains("game", ignoreCase = true)) return false
    if (packageName.startsWith("com.example.") || packageName.startsWith("test.")) return false
    
    // 检查通知重要性
    return sbn.notification.importance >= NotificationManager.IMPORTANCE_LOW
}
```

---

## 九、配置与作用域

### 9.1 LSPosed 作用域配置

在 `res/values/arrays.xml` 中声明模块作用范围：

```xml
<resources>
    <string-array name="dynamic_island_scope">
        <item>com.android.systemui</item>     <!-- AOSP -->
        <item>com.miui.systemui</item>       <!-- MIUI/HyperOS -->
        <item>com.xiaomi.misettings</item>    <!-- 小米设置 -->
    </string-array>
</resources>
```

### 9.2 模块配置界面

使用 Jetpack Compose 构建配置界面：

```kotlin
@Composable
fun SettingsScreen(viewModel: SettingsViewModel) {
    val settings by viewModel.settings.collectAsState()
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text("灵动岛设置", style = MaterialTheme.typography.headlineMedium)
        
        Switch(
            checked = settings.showMusicNotification,
            onCheckedChange = { viewModel.setShowMusicNotification(it) }
        )
        Text("显示音乐通知")
        
        Switch(
            checked = settings.showDownloadProgress,
            onCheckedChange = { viewModel.setShowDownloadProgress(it) }
        )
        Text("显示下载进度")
    }
}
```

---

## 十、常见问题与调试

### 10.1 类找不到

不同厂商、不同 Android 版本类名可能不同，使用 Try-Catch 兜底：

```kotlin
val classNames = listOf(
    "com.android.systemui...ClassA",
    "com.android.systemui...ClassB"
)

for (className in classNames) {
    try {
        val clazz = XposedHelpers.findClass(className, lpparam.classLoader)
        // Hook 逻辑
        break
    } catch (e: Throwable) {
        // 继续尝试下一个
    }
}
```

### 10.2 查看日志

```bash
# 过滤模块日志
adb logcat | grep DynamicIslandXposed

# 重启 SystemUI（无需重启设备）
adb shell killall com.android.systemui
```

### 10.3 调试技巧

```kotlin
// 在关键位置添加日志
XposedBridge.log("[$TAG] 方法被调用: ${param.method.name}")

// 使用 XC_LoadPackage.LoadPackageParam 的 isFirstApplication 
// 判断是否首次加载应用
if (lpparam.isFirstApplication) {
    // 执行初始化逻辑
}
```

---

## 十一、相关资源

- [LSPosed 官方仓库](https://github.com/LSPosed/LSPosed)
- [Xposed API 文档](https://api.xposed.info/)
- [HyperIsland 参考项目](https://github.com/1812z/HyperIsland)
- [HyperCeiler 参考项目](https://github.com/LSPosed/HyperCeiler)

---

*本文档为 HyperDynamicIsland 项目学习笔记，持续更新中。*
