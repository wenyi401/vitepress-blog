---
title: Android Xposed/LSPosed 框架深度解析与 Hook 实战
date: 2026-04-04
tags: [Android开发, Xposed, LSPosed, Hook, 系统框架]
---

# Android Xposed/LSPosed 框架深度解析与 Hook 实战

> 学习日期：2026-04-04
> 源码：HyperDynamicIsland 项目

---

## 一、框架发展史

```
Xposed (rovo89)
    │
    ├── EdXposed (Alcatraz322) — Android 8.0-11, 基于 Riru
    │       └── Riru 核心 → 注入 Zygote 进程
    │
    └── LSPosed (LSPosed Team) — Android 8.1-15+, 基于 Zygisk
            └── Zygisk 直接集成 → 更隐蔽、更稳定
```

### 版本对比

| 维度 | Xposed | EdXposed | LSPosed |
|------|--------|----------|---------|
| 注入方式 | 替换 app_process | Riru 模块 | Zygisk 集成 |
| Android 版本 | 4.0-8.1 | 8.0-11 | 8.1-15+ |
| 模块隔离 | ❌ | ⚠️ 部分 | ✅ 作用域隔离 |
| 重启需求 | 重启系统 | 重启系统 | 仅重启应用 |
| 抗检测 | 低 | 中 | 高 |

---

## 二、Xposed 核心原理

### 2.1 正常 Android 启动流程

```
Bootloader → Kernel → Init → Zygote(fork) → app_process → Application
```

### 2.2 Xposed 劫持流程

```
Bootloader → Kernel → Init
                    │
                    ▼
            Xposed app_process (定制版)
                    │
                    ├── 加载 XposedBridge.jar
                    └── ZygoteInit.main() → Hook 所有子进程
```

**关键点**：Xposed 替换了 `/system/bin/app_process`，在 Zygote fork 出子进程之前完成 Hook 点注册。

### 2.3 Hook 执行流程

```
beforeHookedMethod(param)  ← 原方法执行前，可修改 param.args
        │
        ▼
     原方法执行
        │
        ▼
afterHookedMethod(param)  ← 原方法执行后，可修改 param.result
```

---

## 三、LSPosed 模块开发实战

### 3.1 xposed_init 入口配置

`src/main/assets/xposed_init` 文件内容：

```
com.example.dynamicislandxposed.hook.MainHook
com.example.dynamicislandxposed.hook.ResourceHook
```

### 3.2 AndroidManifest.xml 关键配置

```xml
<!-- 声明为 Xposed 模块 -->
<meta-data
    android:name="xposedmodule"
    android:value="true" />

<!-- 模块描述 -->
<meta-data
    android:name="xposeddescription"
    android:value="HyperOS 灵动岛增强模块" />

<!-- 最低 Xposed API 版本 -->
<meta-data
    android:name="xposedminversion"
    android:value="82" />
```

### 3.3 MainHook 主入口

```kotlin
class MainHook : IXposedHookLoadPackage {
    
    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {
        // 根据包名判断加载目标
        when (lpparam.packageName) {
            "com.android.systemui" -> hookSystemUI(lpparam)
            "com.miui.systemui" -> hookMiuiSystemUI(lpparam)
            "com.xiaomi.misettings" -> hookMiuiSettings(lpparam)
        }
    }
}
```

**注意**：`handleLoadPackage` 在**每个应用**首次启动时都会调用，需要通过 `lpparam.packageName` 过滤目标。

---

## 四、SystemUI 关键 Hook 点

### 4.1 通知面板 (NotificationPanelView)

```kotlin
private fun hookNotificationPanel(lpparam: XC_LoadPackage.LoadPackageParam) {
    val classNames = listOf(
        "com.android.systemui.statusbar.phone.NotificationPanelView",
        "com.android.systemui.statusbar.phone.NotificationPanelViewController"
    )
    
    for (className in classNames) {
        try {
            val clazz = XposedHelpers.findClass(className, lpparam.classLoader)
            
            XposedBridge.hookAllMethods(clazz, "onNotificationClicked", object : XC_MethodHook() {
                override fun beforeHookedMethod(param: MethodHookParam) {
                    XposedBridge.log("通知被点击")
                }
            })
            
            XposedBridge.hookAllMethods(clazz, "setExpanded", object : XC_MethodHook() {
                override fun beforeHookedMethod(param: MethodHookParam) {
                    val expanded = param.args[0] as Boolean
                    XposedBridge.log("面板展开: $expanded")
                }
            })
            
            break
        } catch (e: Throwable) {
            // 类不存在，尝试下一个
        }
    }
}
```

### 4.2 通知行 (ExpandableNotificationRow)

```kotlin
private fun hookNotificationRow(lpparam: XC_LoadPackage.LoadPackageParam) {
    try {
        val rowClass = XposedHelpers.findClass(
            "com.android.systemui.statusbar.notification.row.ExpandableNotificationRow",
            lpparam.classLoader
        )
        
        XposedBridge.hookAllMethods(rowClass, "setExpanded", object : XC_MethodHook() {
            override fun beforeHookedMethod(param: MethodHookParam) {
                val isExpanded = param.args[0] as Boolean
                if (isExpanded) {
                    XposedBridge.log("通知展开")
                }
            }
        })
        
        XposedBridge.hookAllMethods(rowClass, "onNotificationClick", object : XC_MethodHook() {
            override fun beforeHookedMethod(param: MethodHookParam) {
                XposedBridge.log("通知行点击")
            }
        })
    } catch (e: Throwable) {
        XposedBridge.log("ExpandableNotificationRow Hook 失败: ${e.message}")
    }
}
```

### 4.3 MIUI/HyperOS 特定 Hook

```kotlin
private fun hookMiuiDynamicIsland(lpparam: XC_LoadPackage.LoadPackageParam) {
    val islandClasses = listOf(
        "com.miui.systemui.dynamicIsland.MiuiDynamicIsland",
        "com.miui.systemui.statusbar.analytics.MiuiIslandAnalytics"
    )
    
    for (className in islandClasses) {
        try {
            val clazz = XposedHelpers.findClass(className, lpparam.classLoader)
            
            XposedBridge.hookAllMethods(clazz, "show", object : XC_MethodHook() {
                override fun afterHookedMethod(param: MethodHookParam) {
                    XposedBridge.log("MIUI 灵动岛显示")
                }
            })
            
            XposedBridge.hookAllMethods(clazz, "hide", object : XC_MethodHook() {
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

## 五、核心 API 速查

| API | 用途 |
|-----|------|
| `findAndHookMethod()` | Hook 指定类的指定方法 |
| `hookAllMethods()` | Hook 所有同名方法（含重载） |
| `hookAllConstructors()` | Hook 所有构造函数 |
| `findClass()` | 查找类（不 Hook，仅获取） |
| `callMethod()` | 主动调用目标方法 |
| `setObjectField()` | 修改对象字段值 |
| `getObjectField()` | 读取对象字段值 |

---

## 六、通知优先级体系

| 通知类型 | 优先级分数 | 示例应用 |
|---------|----------|---------|
| 音乐播放中 | 100 | 网易云音乐、QQ音乐 |
| 下载进度 | 90 | 系统下载、百度网盘 |
| 高优先级应用消息 | 80 | 微信、QQ、支付宝 |
| 普通通知 | 30~60 | 其他应用 |

---

## 七、常见问题与调试

### 7.1 类找不到问题

**原因**：不同厂商、不同 Android 版本，类名可能不同。

**解决方案**：Try-Catch 兜底，尝试多个可能的类名。

```kotlin
val classNames = listOf(
    "com.android.systemui...ClassA",
    "com.android.systemui...ClassB"
)

for (className in classNames) {
    try {
        val clazz = XposedHelpers.findClass(className, lpparam.classLoader)
        // Hook 成功
        break
    } catch (e: Throwable) {
        // 类不存在，尝试下一个
    }
}
```

### 7.2 日志输出

```kotlin
XposedBridge.log("[$TAG] 信息")
```

```bash
adb logcat | grep -E "DynamicIslandXposed|Xposed"
```

---

## 八、安全与检测规避

| 检测方式 | 原理 | 规避思路 |
|---------|------|---------|
| 文件检测 | 检查 app_process 是否被替换 | 使用 Zygisk 注入 |
| 特征检测 | 检测 XposedBridge、riru 等特征类 | 使用 LSPosed |
| 行为检测 | Hook 检测框架的特征方法 | 减少 Hook 点 |

LSPosed 使用 Zygisk 直接在 Zygote 进程中注入代码，不修改任何系统文件，更难被检测。

---

## 九、学习资源

- [LSPosed 官方仓库](https://github.com/LSPosed/LSPosed)
- [Xposed API 文档](https://api.xposed.info/)
- [HyperCeiler 参考项目](https://github.com/LSPosed/HyperCeiler)

---

*本文档为 HyperDynamicIsland 项目学习笔记，持续更新中。*
