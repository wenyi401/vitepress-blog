---
title: Kotlin异常处理深度解析
date: 2026-04-04 00:50:00
tags: [Kotlin学习]
---

前言

Kotlin 将所有异常视为非受检异常，简化了异常处理流程。本文将深入解析 Kotlin 异常处理的核心概念、最佳实践和高级用法。
一、异常概述

Kotlin 异常处理包含两个主要操作：
- **抛出异常**：指示问题发生
- **捕获异常**：手动处理异常

异常由 Exception 类的子类表示，Exception 是 Throwable 的子类。
二、抛出异常
基本语法

```kotlin
throw IllegalArgumentException()
```
包含详细信息

```kotlin
val cause = IllegalStateException("Original cause: illegal state")

if (userInput  {
    require(count >= 0) { "Count must be non-negative. You set count to $count." }
    return List(count) { it + 1 }
}

// 测试
getIndices(-1)  // 抛出 IllegalArgumentException
getIndices(3)   // [1, 2, 3]
```
check() 函数

用于验证对象或变量状态：

```kotlin
var someState: String? = null

fun getStateValue(): String {
    val state = checkNotNull(someState) { "State must be set beforehand!" }
    check(state.isNotEmpty()) { "State must be non-empty!" }
    return state
}

// 测试
someState = null
getStateValue()  // 抛出 IllegalStateException: State must be set beforehand!

someState = ""
getStateValue()  // 抛出 IllegalStateException: State must be non-empty!

someState = "valid"
getStateValue()  // 返回 "valid"
```
error() 函数

用于在 when 表达式中处理不应发生的情况：

```kotlin
class User(val name: String, val role: String)

fun processUserRole(user: User) {
    when (user.role) {
        "admin" -> println("${user.name} is an admin.")
        "editor" -> println("${user.name} is an editor.")
        "viewer" -> println("${user.name} is a viewer.")
        else -> error("Undefined role: ${user.role}")
    }
}

// 测试
processUserRole(User("Alice", "admin"))  // Alice is an admin.
processUserRole(User("Bob", "guest"))    // 抛出 IllegalStateException: Undefined role: guest
```
四、try-catch 块
基本用法

```kotlin
try {
    // 可能抛出异常的代码
} catch (e: SomeException) {
    // 处理异常
}
```
作为表达式

```kotlin
val num: Int = try {
    count()
} catch (e: ArithmeticException) {
    -1
}
```
多个 catch 块

```kotlin
open class WithdrawalException(message: String) : Exception(message)
class InsufficientFundsException(message: String) : WithdrawalException(message)

fun processWithdrawal(amount: Double, availableFunds: Double) {
    if (amount > availableFunds) {
        throw InsufficientFundsException("Insufficient funds for the withdrawal.")
    }
    if (amount = 0) { "Value must be non-negative" }
    check(initialized) { "Not initialized" }
}

// 不推荐
fun process(value: Int) {
    if (value < 0) {
        throw IllegalArgumentException("Value must be non-negative")
    }
}
```
2. 创建有意义的异常消息

```kotlin
// 推荐
throw IllegalArgumentException("User age must be at least 18, but was $age")

// 不推荐
throw IllegalArgumentException("Invalid age")
```
3. 保留原始原因

```kotlin
try {
    // 操作
} catch (e: IOException) {
    throw MyException("Operation failed", e)  // 保留原始异常
}
```
4. 使用 sealed class 创建异常层次结构

```kotlin
sealed class AppException : Exception()
class NetworkException : AppException()
class DatabaseException : AppException()
class ValidationException : AppException()
```
学习资源

- [Exception and error handling | Kotlin Documentation](https://kotlinlang.org/docs/exceptions.html)
- [Kotlin 异常处理新玩法：runCatching 与 try-catch 的"华山论剑"](https://juejin.cn/post/7528183432443904035)

---
深入学习中...*