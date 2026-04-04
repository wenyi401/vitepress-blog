---
title: Android 灵动岛实现完全指南 - 悬浮窗 + NotificationListenerService
date: 2026-04-04
tags: [Android开发, 灵动岛, 悬浮窗, Jetpack Compose, NotificationListenerService]
---

# Android 灵动岛实现完全指南

> 学习日期：2026-04-04
> 源码：HyperDynamicIsland 项目

---

## 一、概述

灵动岛是 iPhone 14 Pro 引入的系统级 UI 交互形态，Android 侧有三种实现路径：

| 实现方式 | 适用场景 | 优点 | 缺点 |
|---------|---------|------|------|
| Android 14 原生 API | Pixel 8+ / 部分 OEM | 系统级支持，体验最佳 | 仅 Android 14+，需 OEM 支持 |
| 自定义悬浮窗 | 所有 Android 11+ | 兼容性广，完全可控 | 需要 SYSTEM_ALERT_WINDOW 权限 |
| Xposed/LSPosed Hook | 需要深度定制 | 可 Hook 系统行为 | 需要 Root |

**HyperDynamicIsland 项目采用：悬浮窗 + LSPosed Hook 混合方案**

---

## 二、通知拦截 (NotificationListenerService)

### 2.1 核心实现

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
            
            // 优先级判断：只显示最重要的通知
            val current = _currentNotification.value
            if (current == null || getPriority(notification) > getPriority(current)) {
                _currentNotification.value = notification
                notifyOverlayService(notification)
            }
        }
    }
}
```

### 2.2 权限请求

用户必须手动授权：
```
设置 → 通知 → 通知使用权 → 选择 Hyper灵动岛
```

代码引导：
```kotlin
private fun isNotificationListenerEnabled(): Boolean {
    val flat = Settings.Secure.getString(
        contentResolver,
        "enabled_notification_listeners"
    )
    return flat?.contains(packageName) == true
}
```

---

## 三、悬浮窗服务 (Overlay Service)

### 3.1 TYPE_APPLICATION_OVERLAY 窗口参数

```kotlin
private fun attachToWindow() {
    val layoutParams = WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        // 关键：TYPE_APPLICATION_OVERLAY 支持 Android 8.0+
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT
    ).apply {
        gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        y = getStatusBarHeight() + 8 // 状态栏高度 + 间距
    }
    
    windowManager.addView(composeView, layoutParams)
}
```

### 3.2 前台服务保活

```kotlin
@AndroidEntryPoint
class DynamicIslandOverlayService : Service() {
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        setupComposeView()
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
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
```

### 3.3 状态栏高度获取

```kotlin
private fun getStatusBarHeight(): Int {
    val resourceId = resources.getIdentifier("status_bar_height", "dimen", "android")
    return if (resourceId > 0) {
        resources.getDimensionPixelSize(resourceId)
    } else {
        60.dp // 默认 fallback
    }
}
```

---

## 四、Jetpack Compose 灵动岛 UI

### 4.1 状态定义

```kotlin
sealed class DynamicIslandState {
    data object Hidden : DynamicIslandState()   // 完全隐藏
    data object Compact : DynamicIslandState()  // 紧凑形态（单点）
    data object Expanded : DynamicIslandState() // 展开形态（长条）
    data object Minimal : DynamicIslandState()  // 最小化（小圆点）
}

data class DynamicIslandUiState(
    val state: DynamicIslandState = DynamicIslandState.Hidden,
    val notification: DynamicIslandNotification? = null,
    val progress: Float = 0f,
    val isMusicPlaying: Boolean = false,
    val musicInfo: MusicInfo? = null
)
```

### 4.2 紧凑形态 UI

```kotlin
@Composable
private fun CompactIsland(
    uiState: DynamicIslandUiState,
    onClick: () -> Unit
) {
    val width by animateDpAsState(
        targetValue = when {
            uiState.notification == null -> 80.dp
            uiState.progress > 0 -> 160.dp  // 下载进度时加宽
            else -> 120.dp
        },
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "width"
    )
    
    Box(
        modifier = Modifier
            .width(width)
            .height(32.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.Black)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (uiState.progress > 0) {
                CircularProgressIndicator(
                    progress = { uiState.progress },
                    modifier = Modifier.size(16.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
                Spacer(Modifier.width(8.dp))
                Text("${(uiState.progress * 100).toInt()}%", ...)
            } else if (uiState.isMusicPlaying) {
                Icon(Icons.Default.MusicNote, ...)
                Spacer(Modifier.width(6.dp))
                Text(uiState.musicInfo?.title ?: "音乐", ...)
            } else if (uiState.notification != null) {
                Icon(Icons.Default.Notifications, ...)
                Spacer(Modifier.width(6.dp))
                Text(uiState.notification.title, ...)
            }
        }
    }
}
```

### 4.3 过渡动画

```kotlin
AnimatedVisibility(
    visible = uiState.state != DynamicIslandState.Hidden,
    enter = expandVertically(
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        )
    ) + fadeIn(),
    exit = shrinkVertically(
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        )
    ) + fadeOut()
)
```

---

## 五、通知数据模型

```kotlin
data class DynamicIslandNotification(
    val id: String,
    val packageName: String,
    val title: String,
    val text: String,
    val icon: Icon?,
    val timestamp: Long,
    val isOngoing: Boolean = false,
    val actions: List<NotificationAction> = emptyList()
)

fun StatusBarNotification.toDynamicIslandNotification(): DynamicIslandNotification {
    val extras = notification.extras
    return DynamicIslandNotification(
        id = key,
        packageName = packageName,
        title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: "",
        text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: "",
        icon = notification.smallIcon,
        timestamp = postTime,
        isOngoing = isOngoing
    )
}
```

---

## 六、与 LSPosed Hook 的协作

LSPosed Hook 负责：
1. 监听 SystemUI 的状态变化
2. 判断通知面板展开/收起
3. 拦截特定通知行为

悬浮窗服务负责：
1. 实际渲染灵动岛 UI
2. 与 NotificationListenerService 通信
3. 响应用户交互

两者通过 StateFlow 进行状态共享。

---

## 七、关键配置清单

**AndroidManifest.xml 权限**：
- `SYSTEM_ALERT_WINDOW` — 悬浮窗
- `BIND_NOTIFICATION_LISTENER_SERVICE` — 通知监听
- `FOREGROUND_SERVICE` — 前台服务

**前台服务类型**：`specialUse`，配合 `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`

**minSdk**：30（Android 11+），灵动岛功能需要

---

*本文档为 HyperDynamicIsland 项目学习笔记，持续更新中。*
