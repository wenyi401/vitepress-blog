---
title: Kotlin泛型深度解析-in-out-where
date: 2026-04-04 02:20:00
tags: [Kotlin学习]
---

前言

Kotlin 泛型提供了类型安全的代码复用机制。与 Java 不同，Kotlin 没有通配符类型，而是使用声明处型变和类型投影。
一、泛型基础
泛型类

```kotlin
class Box(t: T) {
    var value = t
}

val box: Box = Box(1)
// 或类型推断
val box = Box(1)
```
二、型变
Java 的问题

Java 泛型是不变的：`List` 不是 `List` 的子类型。

```java
// Java
List strs = new ArrayList();
List objs = strs; // 编译错误！
objs.add(1); // 如果允许，会导致运行时异常
String s = strs.get(0); // ClassCastException
```
PECS 原则
Producer-Extends, Consumer-Super**：
- 从集合读取（生产者）：使用 `? extends T`
- 向集合写入（消费者）：使用 `? super T`
三、声明处型变
out 修饰符（协变）

```kotlin
interface Source {
    fun nextT(): T
}

fun demo(strs: Source) {
    val objects: Source = strs // OK！
}
```
规则**：当类型参数 T 声明为 out，它只能出现在 out 位置（返回类型），不能出现在 in 位置（参数类型）。
in 修饰符（逆变）

```kotlin
interface Comparable {
    operator fun compareTo(other: T): Int
}

fun demo(x: Comparable) {
    x.compareTo(1.0) // OK
    val y: Comparable = x // OK！
}
```
规则**：当类型参数 T 声明为 in，它只能出现在 in 位置（参数类型），不能出现在 out 位置（返回类型）。
记忆口诀
Consumer in, Producer out!**
四、类型投影
使用处型变

Array 类不能限制为只返回 T，因为它既有 get（返回 T）也有 set（接受 T）：

```kotlin
class Array(val size: Int) {
    operator fun get(index: Int): T
    operator fun set(index: Int, value: T)
}
```
解决方案：类型投影

```kotlin
fun copy(from: Array, to: Array) {
    assert(from.size == to.size)
    for (i in from.indices)
        to[i] = from[i]
}

val ints: Array = arrayOf(1, 2, 3)
val any = Array(3) { "" }
copy(ints, any) // OK！
```

`Array` 对应 Java 的 `Array`。
in 投影

```kotlin
fun fill(dest: Array, value: String) {
    for (i in dest.indices)
        dest[i] = value
}
```

`Array` 对应 Java 的 `Array`。
五、星投影

当不知道类型参数时，使用星投影：

```kotlin
// Foo -> Foo 等价于 Foo
// Foo -> Foo 等价于 Foo
// Foo -> Foo 等价于 Foo 用于读取，Foo 用于写入

if (something is List) {
    something.forEach { println(it) } // 元素类型为 Any?
}
```
多类型参数

```kotlin
interface Function

// Function 等价于 Function
// Function 等价于 Function
// Function 等价于 Function
```
六、泛型函数

```kotlin
fun  singletonList(item: T): List {
    return listOf(item)
}

fun  T.basicToString(): String { // 扩展函数
    return toString()
}

// 调用
val l = singletonList(1)
val l = singletonList(1) // 类型推断
```
七、泛型约束
上界

```kotlin
fun > sort(list: List) {
    // ...
}

sort(listOf(1, 2, 3)) // OK：Int 是 Comparable 的子类型
sort(listOf(HashMap())) // 错误：HashMap 不是 Comparable
```
多重约束

```kotlin
fun  copyWhenGreater(list: List, threshold: T): List
    where T : CharSequence,
          T : Comparable {
    return list.filter { it > threshold }.map { it.toString() }
}
```
八、非空类型

使用 `& Any` 声明非空类型参数：

```kotlin
interface Game {
    fun load(x: T & Any): T & Any
}

interface ArcadeGame : Game {
    override fun load(x: T1 & Any): T1 & Any
}
```
九、类型擦除

泛型类型检查在编译时进行，运行时类型信息被擦除。
类型检查限制

```kotlin
// 错误：不能检查泛型类型
if (list is List) { } // 编译错误

// 正确：星投影
if (list is List) {
    list.forEach { println(it) }
}
```
未检查的类型转换

```kotlin
val intsDictionary: Map = readDictionary(file) as Map
// 警告：Unchecked cast

// 抑制警告
@Suppress("UNCHECKED_CAST")
inline fun  List.asListOfType(): List? =
    if (all { it is T })
        this as List
    else
        null
```
具体化类型参数

使用 reified 关键字保留类型信息：

```kotlin
inline fun  List.asListOfType(): List? =
    if (all { it is T })
        this as List
    else
        null
```
十、下划线操作符

使用 _ 自动推断类型参数：

```kotlin
abstract class SomeClass {
    abstract fun execute(): T
}

class SomeImplementation : SomeClass() {
    override fun execute(): String = "Test"
}

object Runner {
    inline fun , T> run(): T {
        return S::class.java.getDeclaredConstructor().newInstance().execute()
    }
}

fun main() {
    val s = Runner.run() // T 自动推断为 String
}
```
学习资源

- [Generics: in, out, where | Kotlin Documentation](https://kotlinlang.org/docs/generics.html)
- [Java Generics FAQ](http://www.angelikalanger.com/GenericsFAQ/JavaGenericsFAQ.html)

---
深入学习中...*