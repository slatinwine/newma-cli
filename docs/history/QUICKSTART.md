# Newma (牛码) v3.1.0 - 快速开始

## ⚙️ 配置（首次使用必读）

### 最快配置方式（推荐）⚡

运行交互式配置向导：

```bash
npm run init-settings
```

这个命令会引导你完成所有配置，包括 API Key、Base URL 和模型设置。

### 手动配置

**方式一：settings.json（推荐）**

```bash
# 项目配置
cp settings.example.json settings.json
# 编辑 settings.json 填入 API Key

# 或全局配置
mkdir -p ~/.kode
cp settings.example.json ~/.kode/settings.json
```

**方式二：.env 文件**

```bash
cp .env.example .env
# 编辑 .env 填入 API Key
```

**配置示例**：
```json
{
  "openai": {
    "apiKey": "sk-your-api-key-here",
    "baseUrl": "https://api.openai.com",
    "model": "gpt-4o-mini"
  }
}
```

📖 详细配置说明：[SETTINGS.md](./SETTINGS.md)

---

## 🚀 最简单的使用方法

```bash
# 直接使用，所有功能自动启用！
npx newma-cli "your requirement here"
```

**就这么简单！** Newma (牛码) 会自动：
- ✅ 🤖 自主执行任务
- ✅ 📉 压缩 API 调用（节省 73% token）
- ✅ 🔧 自动修复错误
- ✅ 🧠 自动优化性能

---

## 💡 实际例子

### 1. 创建新功能

```bash
npx newma-cli "add user authentication with JWT"
```

**Newma (牛码) 会**:
- 分析需求
- 设计架构
- 编写代码
- 测试功能
- 优化性能

### 2. 修复 Bug

```bash
npx newma-cli "fix the memory leak in the data processing module"
```

**Newma (牛码) 会**:
- 定位问题
- 修复错误
- 验证修复
- 运行测试

### 3. 重构代码

```bash
npx newma-cli "refactor the API layer to use async/await"
```

**Newma (牛码) 会**:
- 理解代码结构
- 安全重构
- 保持功能不变
- 添加测试

### 4. 添加测试

```bash
npx newma-cli "add comprehensive unit tests for the user service"
```

**Newma (牛码) 会**:
- 分析代码
- 生成测试用例
- 覆盖边界情况
- 运行验证

---

## 🎯 常用场景

### Web 开发

```bash
# 创建 React 组件
npx newma-cli "create a responsive Navigation component with dropdown menu"

# 添加 API 端点
npx newma-cli "add REST API endpoints for user management"

# 集成数据库
npx newma-cli "integrate MongoDB for storing user profiles"
```

### 后端开发

```bash
# 创建微服务
npx newma-cli "create a microservice for email notifications"

# 添加认证
npx newma-cli "implement OAuth2 authentication"

# 优化性能
npx newma-cli "optimize database queries for better performance"
```

### DevOps

```bash
# 创建 Docker 配置
npx newma-cli "create Docker configuration for multi-stage build"

# 添加 CI/CD
npx newma-cli "set up GitHub Actions for automated testing and deployment"

# 监控和日志
npx newma-cli "add logging and monitoring to the application"
```

---

## ⚙️ 如果需要更多控制

### 禁用自主模式（交互式）

```bash
npx newma-cli --no-autonomous "your requirement"
```

### 禁用压缩（完整上下文）

```bash
npx newma-cli --no-compress "your requirement"
```

### 传统模式（完全手动）

```bash
npx newma-cli --no-autonomous --no-compress "your requirement"
```

---

## 📚 更多信息

- **DEFAULT_FEATURES.md** - 默认功能详细说明
- **COMPRESSION.md** - Token 压缩详解
- **AUTONOMOUS.md** - 自主模式详解
- **README.md** - 完整文档

---

## 🎉 开始使用

```bash
# 立即开始
npx newma-cli "create a simple todo list application"
```

**就是这么简单！** 🚀

---

**版本**: v3.1.0+
**最后更新**: 2025-01-16
