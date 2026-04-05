---
title: Android LSPosed Modern API 完全指南 - 从 Legacy 到 Modern 的迁移之路
date: 2026-04-05 10:00:00
tags: [Android开发, LSPosed, Xposed, Modern API, Zygisk, Hook框架]
description: 深入解析 LSPosed Modern Xposed API 的架构设计、模块开发流程、与 Legacy API 的差异对比，以及实际项目中的最佳实践。
---

# Android LSPosed Modern API 完全指南

> 2026-04-05 | 适用版本：LSPosed 2.x+ | 目标：掌握 Modern Xposed API 开发

---

## 前言

LSPosed 框架在 2024 年推出了全新的 Modern Xposed API，带来了革命性的变化。本文将从实际项目经验出发，详细解析 Modern API 的设计理念、迁移路径以及在灵动岛（Dynamic Island）模块开发中的最佳实践。

**本文配套实战项目**：[HyperDynamicIsland](https://github.com/wposed-modules/DynamicIslandXposed)

---

## 一、Modern API 诞生的背景

### 1.1 Legacy API 的局限性

传统 Xposed API 存在以下问题：

1. **安全风险**：Legacy API 的 `IXposedHookLoadPackage` 在模块自身进程也会执行，容易被检测
2. **元数据混乱**：模块配置分散在 `AndroidManifest.xml` 的 metadata 中，难以维护
3. **作用域模糊**：没有明确的作用域隔离机制
4. **R8 兼容性差**：反射调用导致 R8 压缩困难

### 1.2 Modern API 的设计目标

```
┌─────────────────────────────────────────────────────────────┐
│              Modern Xposed API 核心设计原则                   │
├─────────────────────────────────────────────────────────────┤
│  ✅ 安全隔离：模块不再 Hook 自身进程                          │
│  ✅ 配置外置：module.prop 替代 metadata                      │
│  ✅ 作用域明确：scope.list 白名单机制                        │
│  ✅ R8 友好：类型安全的 Hooker 接口                          │
│  ✅ 现代化工具：Remote Preferences / Remote Files             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、项目结构对比

### 2.1 Legacy API 结构

```
app/src/main/
├── assets/
│   └── xposed_init              # 入口文件（全类名）
├── java/com/example/hook/
│   └── MainHook.kt             # 实现 IXposedHookLoadPackage
└── AndroidManifest.xml          # 包含所有模块元数据
```

**AndroidManifest.xml 中的模块配置**：
```xml
<meta-data
    android:name="xposedmodule"
    android:value="true" />
<meta-data
    android:name="xposeddescription"
    android:value="模块描述" />
<meta-data
    android:name="xposedminversion"
    android:value="52" />
<meta-data
    android:name="xposedscope"
    android:resource="@array/xposed_scope" />
```

### 2.2 Modern API 结构

```
app/src/main/
├── resources/META-INF/xposed/
│   ├── java_init.list          # Java 入口（一行一个类名）
│   ├── scope.list              # 作用域包名（一行一个）
│   └── module.prop             # 模块配置（Java Properties 格式）
├── java/com/example/hook/
│   └── ModernMainHook.kt       # 实现 XposedModule
└── AndroidManifest.xml         # 不再包含 xposed 相关 metadata
```

**关键区别**：
- 不再需要 `assets/xposed_init`
- 不再需要 `AndroidManifest.xml` 中的 xposed metadata
- Gradle 会自动将 `resources/META-INF/xposed/` 打包到 APK

---

## 三、module.prop 详解

```properties
# 模块标识
name=HyperDynamicIsland
version=1.0
versionCode=1
author=wenyi401
description=HyperOS 风格灵动岛增强模块

# API 版本要求（必须）
minApiVersion=101
targetApiVersion=105

# 是否强制仅作用域内应用（可选）
staticScope=false
```

**版本对应关系**：
| minApiVersion | 对应 LSPosed 版本 |
|--------------|------------------|
| 89 | LSPosed 1.8.x |
| 93 | LSPosed 1.9.x |
| 101 | LSPosed 2.0+ |

---

## 四、scope.list 配置

```
# 每行一个包名，支持 # 注释
com.android.systemui
com.miui.systemui
com.android.providers.downloads
# com.android.launcher  # 已注释
```

**作用域规则**：
- 模块只能 Hook `scope.list` 中声明的应用
- Hook 其他应用会被 LSPosed 拒绝
- 建议只包含必要应用，减少兼容性风险

---

## 五、Java 入口实现

### 5.1 Legacy API 实现

```kotlin
class MainHook : IXposedHookLoadPackage {
    
    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {
        // ⚠️ 模块自身进程也会触发
        if (lpparam.packageName != TARGET_PACKAGE) return
        
        XposedHelpers.findAndHookMethod(
            "com.android.systemui.statusbar.phone.NotificationPanelView",
            lpparam.classLoader,
            "onNotificationClick",
            object : XC_MethodHook() {
                override fun beforeHookedMethod(param: MethodHookParam) {
                    // 处理逻辑
                }
            }
        )
    }
}
```

### 5.2 Modern API 实现

```kotlin
@XposedModule
class ModernMainHook(
    modulePath: String,
    loadedParam: ModuleLoadedParam
) : XposedModule(modulePath, loadedParam) {

    override fun onModuleLoaded() {
        // ✅ 模块加载完成时调用
        // 不应该在这里执行耗时操作
        log("模块已加载: ${loadedParam.moduleInfo.name}")
        log("模块版本: ${loadedParam.moduleInfo.versionName}")
    }

    override fun onHookedPackageLoaded(param: HookedPackageLoadedParam) {
        // ✅ 只有目标应用加载时才会调用
        // 模块自身进程不会触发
        when (param.packageName) {
            TARGET_SYSTEM_UI -> hookSystemUI(param)
            TARGET_MIUI_SYSTEM_UI -> hookMiuiSystemUI(param)
        }
    }
}
```

### 5.3 核心区别

| 方面 | Legacy | Modern |
|------|--------|--------|
| 模块自身是否 Hook | ⚠️ 是（需手动判断） | ✅ 否（自动隔离） |
| 初始化时机 | 构造函数 | `onModuleLoaded()` |
| 包加载回调 | `handleLoadPackage` | `onHookedPackageLoaded` |
| 类查找 | `XposedHelpers` | `findClass()` 实例方法 |

---

## 六、Hook 方法对比

### 6.1 Legacy Hook 方式

```kotlin
// 查找并 Hook 方法
XposedHelpers.findAndHookMethod(
    className,           // 类名（字符串）
    classLoader,         // ClassLoader
    methodName,          // 方法名
    paramType1,          // 参数类型
    paramType2,
    object : XC_MethodHook() {
        override fun beforeHookedMethod(param: MethodHookParam) {
            // 方法执行前
            param.args[0] = "modified"  // 修改参数
        }
        
        override fun afterHookedMethod(param: MethodHookParam) {
            param.result = "modified"   // 修改返回值
        }
    }
)

// 调用原始方法
param.callOriginalMethod()
```

### 6.2 Modern Hook 方式

```kotlin
// 使用类型安全的 Hooker 接口
class NotificationClickHooker : Hooker<NotificationClickHooker.Callback> {
    
    interface Callback {
        fun onNotificationClick(packageName: String, key: String)
    }
    
    override fun intercept(chain: Chain<Callback>) {
        val args = chain.args()
        val packageName = args[0] as String
        val key = args[1] as String
        
        chain.callback().onNotificationClick(packageName, key)
        chain.proceed()  // 继续执行原方法
    }
}

// 应用 Hook
findClass("com.android.SystemUI.NotificationPresenter", param.classLoader)
    .getDeclaredMethod("onNotificationClick", String::class.java, String::class.java)
    .hookMethod(NotificationClickHooker())
```

### 6.3 拦截器链模型

Modern API 采用了 OkHttp 风格的拦截器链：

```
┌────────────────────────────────────────────────────────────┐
│                    Hook Interceptor Chain                  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   Request ──▶ [Hooker 1] ──▶ [Hooker 2] ──▶ [Hooker 3]     │
│                    │              │              │          │
│               beforeCall()    beforeCall()   beforeCall()   │
│                    │              │              │          │
│               proceed() ────── proceed() ────── proceed()   │
│                    │              │              │          │
│               afterCall()     afterCall()    afterCall()    │
│                    │              │              │          │
│   Response ◀──────┴──────────────┴──────────────┘          │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**优先级**：数字越小越先执行（类似 Android 的触摸事件分发）

---

## 七、配置共享方案

### 7.1 方案对比

| 方案 | API | 存储位置 | 变更监听 | 大文件 |
|------|-----|---------|---------|--------|
| XSharedPreferences | Legacy | 模块应用内部存储 | ❌ | ❌ |
| Remote Preferences | Modern | LSPosed 数据库 | ✅ | ❌ |
| Remote Files | Modern | `/data/adb/lspd/modules/` | ❌ | ✅ |

### 7.2 Remote Preferences 使用

```kotlin
// 初始化（需要模块应用已启动一次）
val remotePrefs = RemotePreferences(
    context,
    "com.example.dynamicislandxposed",
    "settings"
)

// 读取配置
val isEnabled = remotePrefs.getBoolean("enabled", true)
val priorityApps = remotePrefs.getStringSet("priority_apps", emptySet())
val themeColor = remotePrefs.getInt("theme_color", 0xFF000000.toInt())

// 监听变更
remotePrefs.registerOnSharedPreferenceChangeListener { _, key ->
    when (key) {
        "enabled" -> {
            val newValue = remotePrefs.getBoolean("enabled", true)
            // 更新悬浮窗状态
        }
        "theme_color" -> {
            // 重新加载主题
        }
    }
}
```

### 7.3 Remote Files 用于大数据

```kotlin
// 存储大型数据（如缓存的专辑封面）
val remoteFile = RemoteFile("album_covers/${packageName}.dat")

// 写入
remoteFile.writeBytes(albumArtBytes)

// 读取
val cachedArt = remoteFile.readBytes()
```

---

## 八、实际项目中的应用

### 8.1 灵动岛通知拦截架构

```kotlin
@XposedModule
class DynamicIslandModule(
    modulePath: String,
    loadedParam: ModuleLoadedParam
) : XposedModule(modulePath, loadedParam) {

    override fun onHookedPackageLoaded(param: HookedPackageLoadedParam) {
        when (param.packageName) {
            "com.android.systemui" -> {
                hookNotificationPresenter(param)
                hookStatusBar(param)
            }
            "com.miui.systemui" -> {
                hookMiuiDynamicIsland(param)
            }
        }
    }

    private fun hookNotificationPresenter(param: HookedPackageLoadedParam) {
        // Hook 通知添加
        findClass(
            "com.android.systemui.statusbar.notification.NotifPipeline",
            param.classLoader
        ).hookMethod("addNotification", object : XC_MethodHook() {
            override fun afterHookedMethod(param: MethodHookParam) {
                val sbn = param.args[0] as StatusBarNotification
                if (shouldIntercept(sbn)) {
                    sendToOverlayService(sbn)
                }
            }
        })

        // Hook 通知移除
        findClass(
            "com.android.systemui.statusbar.notification.NotifPipeline",
            param.classLoader
        ).hookMethod("removeNotification", object : XC_MethodHook() {
            override fun beforeHookedMethod(param: MethodHookParam) {
                val key = param.args[0] as String
                removeFromOverlayService(key)
            }
        })
    }
}
```

### 8.2 与悬浮窗服务的 IPC

```kotlin
// 在模块 Hook 中发送数据到悬浮窗服务
private fun sendToOverlayService(sbn: StatusBarNotification) {
    val intent = Intent(ACTION_SHOW_NOTIFICATION).apply {
        putExtra(EXTRA_KEY, sbn.key)
        putExtra(EXTRA_PACKAGE, sbn.packageName)
        putExtra(EXTRA_TITLE, sbn.notification.extras.getString(EXTRA_TITLE))
        putExtra(EXTRA_TEXT, sbn.notification.extras.getString(EXTRA_TEXT))
        setPackage("com.example.dynamicislandxposed")  // 模块自己的包名
    }
    
    // 使用 Flag 确保持续传递
    try {
        sendBroadcast(intent, RECEIVER_NOT_EXPORTED)
    } catch (e: SecurityException) {
        // 权限不足时静默失败
    }
}
```

---

## 九、迁移 checklist

如果要从 Legacy API 迁移到 Modern API：

- [ ] 创建 `resources/META-INF/xposed/` 目录
- [ ] 创建 `java_init.list` 文件
- [ ] 创建 `scope.list` 文件
- [ ] 创建 `module.prop` 文件
- [ ] 将入口类从 `IXposedHookLoadPackage` 改为 `XposedModule`
- [ ] 将 `handleLoadPackage` 改为 `onHookedPackageLoaded`
- [ ] 移除 `AndroidManifest.xml` 中的 xposed metadata
- [ ] 将 `XposedHelpers` 调用改为 `findClass()` + `hookMethod()`
- [ ] 替换配置共享方式为 Remote Preferences
- [ ] 测试作用域是否正确生效
- [ ] 启用 R8 压缩，验证功能正常

---

## 十、常见问题

### Q1: Modern API 可以在 Legacy 模式下使用吗？

**可以**。LSPosed 的 Modern API 是向后兼容的，但 Modern API 的特性（如作用域隔离）只在 Zygisk 模式下生效。

### Q2: 如何调试 Modern API 模块？

```bash
# 查看模块日志
adb logcat | grep -E "Xposed|LSPosed|模块名"

# 重启 SystemUI（无需重启设备）
adb shell killall com.android.systemui

# 查看 LSPosed 日志
adb shell "cat /data/adb/lspd/logs/$(date +%Y%m%d).log"
```

### Q3: `findClass()` 找不到类怎么办？

```kotlin
// 使用类名列表兜底
val classNames = listOf(
    "com.android.systemui.statusbar.phone.NotificationPanelView",
    "com.android.systemui.statusbar.phone.NotificationPanelViewController"
)

for (className in classNames) {
    try {
        val clazz = findClass(className, param.classLoader)
        // Hook 逻辑
        break
    } catch (e: ClassNotFoundError) {
        continue
    }
}
```

---

## 总结

Modern Xposed API 带来了更安全、更现代的开发体验：

1. **安全隔离**：模块不再 Hook 自身进程
2. **配置外置**：module.prop 使配置更清晰
3. **类型安全**：Hook 接口提供编译时检查
4. **R8 友好**：更容易进行代码压缩和混淆
5. **配置共享**：Remote Preferences 支持实时同步

**建议**：新项目直接使用 Modern API，老项目逐步迁移。

---

*本文档为 HyperDynamicIsland 项目学习笔记，持续更新中。*
*有问题？欢迎提交 Issue！*
