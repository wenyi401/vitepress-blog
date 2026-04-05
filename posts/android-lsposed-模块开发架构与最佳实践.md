# Android LSPosed 模块开发架构与最佳实践

> 学习日期：2026-04-05
> 标签：[Android开发, LSPosed, Xposed, 架构设计, 模块开发]

---

## 一、LSPosed 模块核心架构

### 1.1 进程间通信（IPC）问题

LSPosed 模块运行在 **Zygote 进程**，而悬浮窗服务运行在**独立进程**。这是最容易踩的坑：

```
┌─────────────────────────────────────────────────────┐
│ Zygote 进程 (Hook 生效处)                            │
│  ├── MainHook.handleLoadPackage()                   │
│  └── 可以 Hook SystemUI 的类                        │
│                                                     │
│  ❌ 不能直接访问:                                    │
│     - 悬浮窗 Service 的 ViewModel                   │
│     - SharedPreferences (MODE_PRIVATE)              │
│     - 本模块的 Activity/Service                     │
└─────────────────────────────────────────────────────┘
                          ↕ (跨进程)
┌─────────────────────────────────────────────────────┐
│ 应用进程 (模块自己的进程)                             │
│  ├── DynamicIslandOverlayService (悬浮窗)           │
│  ├── NotificationListenerService                    │
│  ├── MainActivity (配置界面)                        │
│  └── SharedPreferences (自己的)                     │
└─────────────────────────────────────────────────────┘
```

### 1.2 正确的跨进程通信方式

#### 方案一：BroadcastReceiver（简单场景）

```kotlin
// Hook 中发送广播
private fun notifyOverlay() {
    val intent = Intent("com.example.dynamicislandxposed.SHOW_ISLAND")
    intent.putExtra("title", "新通知")
    intent.putExtra("text", "通知内容")
    mainProcessContext.sendBroadcast(intent)
}

// 悬浮窗服务中注册接收
private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        when (intent?.action) {
            "com.example.dynamicislandxposed.SHOW_ISLAND" -> {
                val title = intent.getStringExtra("title") ?: return
                viewModel.showNotification(title, intent.getStringExtra("text") ?: "")
            }
        }
    }
}
```

#### 方案二：ContentProvider（推荐，结构化数据）

```kotlin
// 在模块的 AndroidManifest.xml 中注册 Provider
<provider
    android:name=".provider.DynamicIslandProvider"
    android:authorities="com.example.dynamicislandxposed.provider"
    android:exported="false"
    android:process=":module" />

// Provider 实现
class DynamicIslandProvider : ContentProvider() {
    
    companion object {
        const val AUTHORITY = "com.example.dynamicislandxposed.provider"
        private val uriMatcher = UriMatcher(UriMatcher.NO_MATCH).apply {
            addURI(AUTHORITY, "notification", 1)
            addURI(AUTHORITY, "config", 2)
        }
        
        // 供 Hook 进程调用的方法
        fun pushNotification(ctx: Context, notif: NotificationData) {
            val values = ContentValues().apply {
                put("title", notif.title)
                put("text", notif.text)
                put("package", notif.packageName)
            }
            ctx.contentResolver.insert(
                Uri.parse("content://$AUTHORITY/notification"), 
                values
            )
        }
    }
    
    override fun insert(uri: Uri, values: ContentValues?): Uri? {
        // 收到 Hook 进程的数据，通知悬浮窗更新
        when (uri.pathSegments.getOrNull(0)) {
            "notification" -> {
                val title = values?.getAsString("title") ?: return null
                // 通知 Service 更新
                NotificationBus.post(NotificationData(title, ...))
            }
        }
        return uri
    }
}
```

#### 方案三：LocalSocket（最灵活，推荐高复杂度场景）

```kotlin
// Hook 进程
class HookSocketClient {
    private var socket: LocalSocket? = null
    
    fun connect() {
        socket = LocalSocket().apply {
            connect(LocalSocketAddress("dynamic_island_socket", 
                LocalSocketAddress.Namespace.ABSTRACT))
        }
    }
    
    fun send(data: ByteArray) {
        socket?.outputStream?.write(data)
    }
}

// 悬浮窗服务进程
class OverlaySocketServer {
    private var serverSocket: LocalServerSocket? = null
    
    fun start() {
        serverSocket = LocalServerSocket("dynamic_island_socket")
        Thread {
            while (true) {
                val client = serverSocket?.accept()
                client?.let { handleClient(it) }
            }
        }.start()
    }
}
```

---

## 二、Hook 最佳实践

### 2.1 防止 Hook 失败的最佳策略

```kotlin
class MainHook : IXposedHookLoadPackage {

    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {
        // 1. 永远用 Try-Catch 包裹每个 Hook
        // 2. 类名列表遍历，不要只尝试一个
        // 3. hookAllMethods 比 findAndHookMethod 更健壮
        
        val targetClasses = listOf(
            // AOSP
            "com.android.systemui.statusbar.phone.NotificationPanelView",
            "com.android.systemui.statusbar.phone.NotificationPanelViewController",
            // MIUI/HyperOS
            "com.miui.systemui.statusbar.phone.NotificationPanelView",
            "com.miui.systemui.statusbar.phone.NotificationPanelController"
        )
        
        for (className in targetClasses) {
            try {
                val clazz = XposedHelpers.findClass(className, lpparam.classLoader)
                hookNotificationPanel(clazz)
                XposedBridge.log("✓ Hooked: $className")
                break // 成功就跳出
            } catch (e: ClassNotFoundError) {
                // 继续尝试下一个
            } catch (e: Throwable) {
                // 其他错误，记录并停止
                XposedBridge.log("✗ $className: ${e.message}")
                break
            }
        }
    }
}
```

### 2.2 推荐的 Hook 方法

```kotlin
// ❌ 不推荐：findAndHookMethod 过于严格
XposedHelpers.findAndHookMethod(
    clazz, 
    "onNotificationClick", 
    object : XC_MethodHook() { ... }
)

// ✅ 推荐：hookAllMethods 更健壮
XposedBridge.hookAllMethods(clazz, "onNotificationClick", object : XC_MethodHook() {
    override fun beforeHookedMethod(param: MethodHookParam) {
        // 拦截点击
    }
})

// ✅ 推荐：监听多种状态变化
XposedBridge.hookAllMethods(clazz, "setExpanded", object : XC_MethodHook() {
    override fun beforeHookedMethod(param: MethodHookParam) {
        val isExpanded = param.args[0] as? Boolean ?: return
        XposedBridge.log("展开状态: $isExpanded")
    }
})
```

### 2.3 Hook 时机选择

| 场景 | 推荐 Hook 时机 | 说明 |
|------|--------------|------|
| 通知监听 | `afterHookedMethod` | 通知已处理完毕，获取完整数据 |
| 阻止操作 | `beforeHookedMethod` + `returnEarly` | 在操作执行前拦截 |
| 修改返回值 | `afterHookedMethod` + `param.result` | 原方法执行完后修改 |
| 获取对象状态 | `afterHookedMethod` | 对象已构建完毕 |

```kotlin
// 阻止通知展开的示例
XposedBridge.hookAllMethods(rowClass, "setExpanded", object : XC_MethodHook() {
    override fun beforeHookedMethod(param: MethodHookParam) {
        val shouldExpand = param.args[0] as? Boolean ?: return
        if (shouldExpand && shouldBlockExpansion()) {
            param.result = null // 阻止展开
            return
        }
    }
})
```

---

## 三、悬浮窗服务架构

### 3.1 推荐的 Service 实现

```kotlin
@AndroidEntryPoint
class DynamicIslandOverlayService : Service() {
    
    // 使用 Hilt 注入 ViewModel
    private val viewModel: DynamicIslandViewModel by viewModels()
    
    // 生命周期管理
    private val lifecycleScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    override fun onCreate() {
        super.onCreate()
        setupNotificationReceiver() // 注册广播接收器
        setupWindow()
    }
    
    private fun setupNotificationReceiver() {
        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                when (intent?.action) {
                    ACTION_SHOW_NOTIFICATION -> {
                        val title = intent.getStringExtra("title") ?: return
                        viewModel.showNotification(title, intent.getStringExtra("text") ?: "")
                    }
                    ACTION_HIDE_NOTIFICATION -> {
                        viewModel.hide()
                    }
                }
            }
        }
        
        val filter = IntentFilter().apply {
            addAction(ACTION_SHOW_NOTIFICATION)
            addAction(ACTION_HIDE_NOTIFICATION)
        }
        registerReceiver(receiver, filter, RECEIVER_NOT_EXPORTED)
    }
}
```

### 3.2 ViewModel 最佳实践

```kotlin
@HiltViewModel
class DynamicIslandViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle, // 进程死亡恢复
    private val notificationRepository: NotificationRepository
) : ViewModel() {
    
    // UI 状态
    private val _uiState = MutableStateFlow(
        savedStateHandle.get<NotificationData>("notification")?.let {
            DynamicIslandUiState(notification = it)
        } ?: DynamicIslandUiState()
    )
    val uiState: StateFlow<DynamicIslandUiState> = _uiState.asStateFlow()
    
    // 保存状态到 SavedStateHandle
    private fun saveState() {
        _uiState.value.notification?.let {
            savedStateHandle["notification"] = it
        }
    }
    
    fun showNotification(title: String, text: String) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    state = DynamicIslandState.Compact,
                    notification = NotificationData(title, text)
                )
            }
            saveState()
        }
    }
}
```

---

## 四、依赖注入最佳实践

### 4.1 使用 Hilt 管理所有组件

```kotlin
@Module
@InstallIn(ServiceComponent::class) // Service 也可以用 Hilt
object ServiceModule {
    
    @Provides
    @Singleton
    fun provideNotificationRepository(
        context: Context
    ): NotificationRepository {
        return NotificationRepositoryImpl(context)
    }
}
```

### 4.2 ModuleConfig 改造为 Hilt Singleton

```kotlin
@Singleton
class ModuleConfig @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    
    var isEnabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()
    
    // ... 其他配置项
}
```

---

## 五、与 HyperCeiler 的架构对比

| 维度 | 本项目 | HyperCeiler |
|------|--------|------------|
| IPC 方式 | 广播（待实现） | ContentProvider + 广播 |
| Hook 管理 | 手动遍历类名 | DexKit 动态解析 |
| 配置管理 | SharedPreferences | DataStore |
| UI 架构 | 单一 ViewModel | 多模块 MVVM |
| 进程隔离 | 未考虑 | 完全隔离 |

### HyperCeiler 的关键设计

1. **每个功能独立的 Hook 类**：便于维护和禁用
2. **配置热更新**：Hook 侧实时读取最新配置
3. **资源模块化**：R 类替换实现多主题支持
4. **日志系统**：分级日志，便于调试

---

## 六、常见错误与解决

### 6.1 Hook 不生效

```
排查步骤：
1. 检查模块是否在 LSPosed 中启用
2. 检查作用域是否包含目标应用
3. 确认目标类在当前系统版本存在
4. 查看日志：adb logcat | grep -i xposed
```

### 6.2 进程间通信失效

```
问题：Hook 发的广播在 Service 收不到
原因：Hook 在 Zygote 进程，Service 在独立进程
解决：
1. 确认广播指定了正确的包名
2. 使用 LocalBroadcastManager（已废弃，推荐 ContentProvider）
3. 检查 Service 是否已启动
```

### 6.3 悬浮窗权限问题

```kotlin
// 检查悬浮窗权限
fun hasOverlayPermission(): Boolean {
    return Settings.canDrawOverlays(context)
}

// 请求权限
fun requestOverlayPermission() {
    val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
    )
    activityResultLauncher.launch(intent)
}
```

---

## 七、学习资源

- [LSPosed 官方文档](https://docs.lsposed.org/)
- [HyperCeiler 源码](https://github.com/ReChronoRain/HyperCeiler)（学习 Hook 组织方式）
- [DexKit 动态解析](https://github.com/LuckyPray/DexKit)（告别硬编码类名）

---

*本文档为 HyperDynamicIsland 项目学习笔记，结合 HyperCeiler 架构最佳实践，持续更新。*
