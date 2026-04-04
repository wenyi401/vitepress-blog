---
title: Android ContentProvider内容提供者实战
date: 2026-04-03 23:52:00
tags: [Android开发]
---

前言

ContentProvider 是 Android 四大组件之一，用于跨应用数据共享，提供标准化的增删改查接口。
一、定义 ContentProvider

```kotlin
class MyProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        return true
    }
    
    override fun query(
        uri: Uri,
        projection: Array?,
        selection: String?,
        selectionArgs: Array?,
        sortOrder: String?
    ): Cursor? {
        return null
    }
    
    override fun insert(uri: Uri, values: ContentValues?): Uri? {
        return null
    }
    
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array?): Int {
        return 0
    }
    
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array?): Int {
        return 0
    }
    
    override fun getType(uri: Uri): String? {
        return null
    }
}
```
二、注册 Provider

```xml

```
学习资源

- [ContentProvider | Android Developers](https://developer.android.com/reference/android/content/ContentProvider)
- [Content provider 基础知识](https://developer.android.google.cn/guide/topics/providers/content-provider-basics?hl=zh-cn)

---