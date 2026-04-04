---
title: Kotlin泛型进阶-协变与逆变
date: 2026-04-03 23:28:00
tags: [Kotlin学习]
---

前言

Kotlin 泛型中的协变（Covariance）和逆变（Contravariance）是类型系统的高级特性，用于解决泛型的类型安全问题。
一、泛型基础
泛型类

```kotlin
class Box(val value: T)

val stringBox = Box("Hello")
val intBox = Box(42)
```
泛型函数

```kotlin
fun  List.firstOrNull(): T? {
    return if (isEmpty()) null else this[0]
}
```
泛型约束

```kotlin
fun > max(a: T, b: T): T {
    return if (a > b) a else b
}
```
二、型变问题
为什么需要型变？

```kotlin
open class Animal
class Dog : Animal()
class Cat : Animal()

//  编译错误：List 不是 List 的子类型
val animals: List = listOf(Dog())
```
不变性（Invariant）

默认情况下，泛型是不变的：

```kotlin
class Box(val value: T)

//  编译错误
val box: Box = Box(Dog())
```
三、协变（Covariance）
out 关键字

```kotlin
// 协变：只能读取，不能写入
interface Producer {
    fun produce(): T
}

class DogProducer : Producer {
    override fun produce(): Dog = Dog()
}

//  编译通过：Producer 是 Producer 的子类型
val producer: Producer = DogProducer()
```
协变规则

- 使用 `out` 修饰符
- 只能在返回值位置使用 T
- 不能在参数位置使用 T
示例

```kotlin
// Kotlin 标准库的 List 是协变的
interface List {
    fun get(index: Int): E
    // 不能有 fun add(element: E)
}

val dogs: List = listOf(Dog())
val animals: List = dogs // 
```
四、逆变（Contravariance）
in 关键字

```kotlin
// 逆变：只能写入，不能读取
interface Consumer {
    fun consume(item: T)
}

class AnimalConsumer : Consumer {
    override fun consume(item: Animal) {
        println("Consuming animal")
    }
}

//  编译通过：Consumer 是 Consumer 的子类型
val consumer: Consumer = AnimalConsumer()
```
逆变规则

- 使用 `in` 修饰符
- 只能在参数位置使用 T
- 不能在返回值位置使用 T
示例

```kotlin
// Comparable 是逆变的
interface Comparable {
    fun compareTo(other: T): Int
}

class Dog : Comparable {
    override fun compareTo(other: Dog): Int {
        return 0
    }
}
```
五、型变对比

| 特性 | 协变（out） | 逆变（in） |
|------|------------|-----------|
| **子类型关系** | Producer → Producer | Consumer → Consumer |
| **操作** | 只读（生产） | 只写（消费） |
| **使用位置** | 返回值 | 参数 |
| **记忆口诀** | out = 输出 | in = 输入 |
六、使用处型变
类型投影

```kotlin
// 使用处协变
fun copy(from: Array, to: Array) {
    for (i in from.indices) {
        to[i] = from[i]
    }
}

// 使用处逆变
fun fill(array: Array, value: Any) {
    for (i in array.indices) {
        array[i] = value
    }
}
```
星投影

```kotlin
// 等价于 Array
fun printArray(array: Array) {
    for (item in array) {
        println(item)
    }
}
```
七、实化（Reified）
内联函数 + reified

```kotlin
// 普通泛型无法在运行时获取类型
inline fun  isType(value: Any): Boolean {
    return value is T
}

// 使用
println(isType("Hello")) // true
println(isType("Hello")) // false
```
获取泛型类型

```kotlin
inline fun  create(): T {
    return T::class.java.getDeclaredConstructor().newInstance()
}

val user = create()
```
八、实际应用
协变示例

```kotlin
interface Source {
    fun next(): T
}

fun demo(strs: Source) {
    val objects: Source = strs //  协变
}
```
逆变示例

```kotlin
interface Comparable {
    operator fun compareTo(other: T): Int
}

fun demo(x: Comparable) {
    val double: Comparable = x //  逆变
}
```
PECS 原则
Producer Extends, Consumer Super**

- **生产者（读取）**：使用 `out`（协变）
- **消费者（写入）**：使用 `in`（逆变）
九、最佳实践

1. **遵循 PECS 原则**：生产者用 out，消费者用 in
2. **优先使用声明处型变**：在类定义时指定
3. **合理使用 reified**：需要运行时类型信息时
4. **避免过度使用星投影**：尽量明确类型
5. **理解类型关系**：协变保持子类型关系，逆变反转
学习资源

- [Kotlin泛型中的协变与逆变](https://juejin.cn/post/7475994574528233511)
- [Kotlin基础知识_12-泛型的高级特性](https://www.cnblogs.com/yongdaimi/p/17824129.html)
- [泛型：逆变or协变，傻傻分不清？](https://time.geekbang.org/column/article/480022)

---