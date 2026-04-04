---
title: Android布局Layout深度解析
date: 2026-04-04 06:20:00
tags: [Android开发]
---

前言

布局定义了应用的界面结构。所有元素均使用 View 和 ViewGroup 对象的层次结构进行构建。View 用于绘制用户可看到并交互的内容，ViewGroup 是不可见的容器，用于定义布局结构。
一、核心概念
View 和 ViewGroup

- **View**：微件，如 Button、TextView
- **ViewGroup**：布局，如 LinearLayout、ConstraintLayout
声明方式

1. **XML 声明**：分离外观和行为
2. **运行时实例化**：程序化创建
二、编写 XML

```xml

    
    
    
    

```
三、加载 XML 资源

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.main_layout)
}
```
四、属性
ID

```xml
android:id="@+id/my_button"
```
布局参数

```kotlin
// 宽度和高度
layout_width: match_parent | wrap_content | 具体值
layout_height: match_parent | wrap_content | 具体值

// 外边距
android:layout_margin="16dp"
android:layout_marginTop="16dp"

// 内边距
android:padding="8dp"
android:paddingStart="8dp"
```
五、常见布局
1. LinearLayout

```xml

    

```
2. ConstraintLayout

```xml

    

```
3. FrameLayout

```xml

    

```
4. RelativeLayout

```xml

    

```
六、动态列表
RecyclerView

```kotlin
class MyAdapter(private val items: List) : RecyclerView.Adapter() {
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MyViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item, parent, false)
        return MyViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: MyViewHolder, position: Int) {
        holder.bind(items[position])
    }
    
    override fun getItemCount() = items.size
}
```
七、最佳实践
1. 使用 ConstraintLayout

减少布局层次，提高性能。
2. 使用 dp 而非 px

```xml
android:layout_margin="16dp"
```
3. 避免嵌套过深

保持布局层次浅显。
学习资源

- [View 中的布局 | Android Developers](https://developer.android.google.cn/develop/ui/views/layout/declaring-layout?hl=zh-cn)
- [ConstraintLayout | Android Developers](https://developer.android.google.cn/develop/ui/views/layout/constraint-layout?hl=zh-cn)

---
深入学习中...*