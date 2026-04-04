---
title: HyperDynamicIsland 开发日志 (2026-04-04)
date: 2026-04-04
tags: [Android开发, LSPosed, 灵动岛, 项目开发]
---

# HyperDynamicIsland 开发日志

> 开发时间：2026-04-04
> 状态：代码架构优化完成，构建配置已修复，等待真机测试

## 今日进展

### 1. Gradle 构建配置修复

#### 修复的问题

**问题一**：`settings.gradle.kts` 包含了 `plugins` 块

原代码在 `settings.gradle.kts` 末尾错误地放置了 `plugins` 块，而 `pluginManagement` 和 `dependencyResolutionManagement` 也在其中。这导致 Gradle 配置混乱。

**修复方案**：
- `settings.gradle.kts` 只保留 `pluginManagement`、`dependencyResolutionManagement` 和模块声明
- 根 `build.gradle.kts` 专门放置 `plugins` 块

**问题二**：根 `build.gradle.kts` 包含重复配置

根 `build.gradle.kts` 中错误地放置了 `pluginManagement` 和 `dependencyResolutionManagement`，这些应该只在 `settings.gradle.kts` 中定义。

**修复后**：

`settings.gradle.kts`:
```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
        maven { url = uri("https://api.xposed.info/") }
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://api.xposed.info/") }
    }
}

rootProject.name = "DynamicIslandXposed"
include(":app")
```

`build.gradle.kts` (root):
```kotlin
plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("com.google.dagger.hilt.android") version "2.56" apply false
    id("com.google.devtools.ksp") version "2.0.21-1.0.28" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
}
```

### 2. app/build.gradle.kts 优化

- 添加了 `packaging { resources { excludes += ... } }` 解决资源冲突
- 添加了 `freeCompilerArgs` 用于 opt-in
- 优化了依赖版本管理
- 添加了 `isShrinkResources` 用于 release 构建

### 3. 启动图标资源修复

创建了自适应图标（Adaptive Icon）：

`res/mipmap-anydpi-v26/ic_launcher.xml`:
```xml
<adaptive-icon>
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
```

矢量前景 `res/drawable/ic_launcher_foreground.xml`:
```xml
<vector ...>
    <!-- 黑色背景圆形 -->
    <path android:fillColor="#1A1A1A" .../>
    <!-- 灵动岛药丸形状 -->
    <path android:fillColor="#FFFFFF" .../>
    <!-- 中心圆点 -->
    <path android:fillColor="#1A1A1A" .../>
</vector>
```

### 4. 学习笔记编写

编写了三份详细学习笔记：

1. **Xposed-LSPosed-Deep-Dive.md** — 框架原理与 Hook 实战
   - 框架发展史（Xposed → EdXposed → LSPosed）
   - Hook 机制详解
   - SystemUI 关键 Hook 点
   - 通知优先级体系
   - 调试技巧

2. **Dynamic-Island-Implementation.md** — 悬浮窗与通知服务实现
   - NotificationListenerService 实现
   - TYPE_APPLICATION_OVERLAY 悬浮窗
   - Jetpack Compose UI 状态机
   - 紧凑/展开形态切换动画
   - 与 LSPosed Hook 的协作

3. **Project-Setup-and-Build.md** — 项目构建配置指南
   - Gradle 文件职责划分
   - ProGuard 规则
   - AndroidManifest.xml 完整配置
   - 常见构建错误排查

### 5. 博客更新

今日新增博客文章：
- `android-xposed-lsposed-framework-deep-dive.md` — Xposed/LSPosed 深度解析
- `android-dynamic-island-implementation-guide.md` — 灵动岛实现指南

更新了：
- `android-lsposed-xposed-dynamic-island-develop.md` — 完整开发指南（已存在）

## 当前架构

```
┌─────────────────────────────────────────────────┐
│            LSPosed Hook Layer                   │
│  (MainHook → Hook SystemUI classes)             │
└────────────────────┬────────────────────────────┘
                     │ IPC / StateFlow
┌────────────────────▼────────────────────────────┐
│       NotificationListenerService                 │
│  (拦截通知 → 优先级过滤 → 状态更新)               │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│       DynamicIslandOverlayService                 │
│  (TYPE_APPLICATION_OVERLAY + Compose UI)         │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│           DynamicIslandViewModel                  │
│  (状态管理：Hidden/Compact/Expanded/Minimal)       │
└─────────────────────────────────────────────────┘
```

## 关键 Hook 点清单

### AOSP SystemUI（优先级从高到低）
1. `NotificationPanelView` — 面板展开/收起
2. `ExpandableNotificationRow` — 通知行点击/展开
3. `StatusBarIconController` — 状态栏图标管理
4. `NotificationPresenter` — 通知添加/移除
5. `PhoneWindowManager` — 窗口焦点

### MIUI/HyperOS 特定类
- `com.miui.systemui.dynamicIsland.MiuiDynamicIsland`
- `com.miui.systemui.statusbar.analytics.MiuiIslandAnalytics`

## 待完成事项

- [ ] **真机测试**：在 LSPosed 设备上实际测试 Hook 效果
- [ ] **MIUI 适配**：针对 HyperOS 特定类进行适配
- [ ] **音乐通知解析**：解析 MediaStyle 通知获取更多播放信息
- [ ] **下载进度提取**：从 DownloadManager 获取实时进度
- [ ] **Release 打包**：生成正式签名 APK
- [ ] **抗检测优化**：应对安全检测框架

## 知识沉淀

本次学习的主要收获：

1. **Gradle 配置职责划分**：`pluginManagement` 和 `dependencyResolutionManagement` 只属于 `settings.gradle.kts`，`plugins` 块在根 `build.gradle.kts`

2. **LSPosed vs Xposed**：LSPosed 使用 Zygisk 集成，不修改系统文件，支持作用域隔离，更难被检测

3. **Try-Catch 兜底模式**：不同厂商、不同 Android 版本类名不同，必须使用 Try-Catch 尝试多个可能的类名

4. **TYPE_APPLICATION_OVERLAY**：Android 8.0+ 推荐使用，比 `TYPE_SYSTEM_OVERLAY` 更安全

5. **Compose UI 动画**：`AnimatedVisibility` + `spring` 动画实现灵动岛的弹性展开/收起效果

---

*持续更新中*
