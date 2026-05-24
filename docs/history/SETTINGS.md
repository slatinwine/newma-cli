# 配置说明

Newma (牛码) 支持两种配置方式：**settings.json**（推荐）和 **.env** 文件。

## 方式一: settings.json（推荐）

### 快速开始

运行初始化向导：

```bash
npm run init-settings
```

向导会引导你完成配置，并询问：
- 全局配置（`~/.kode/settings.json`）还是项目配置（`./settings.json`）
- OpenAI API Key、Base URL、模型名称（默认使用智谱 AI）
- 项目偏好设置（工具系统、权限级别等）

### 手动创建配置文件

**项目配置**（仅当前项目生效）:
```bash
# 在项目根目录创建
cp settings.example.json settings.json
# 然后编辑 settings.json 填入你的配置
```

**全局配置**（所有项目生效）:
```bash
# 在用户主目录创建
mkdir -p ~/.kode
cp settings.example.json ~/.kode/settings.json
# 然后编辑 ~/.kode/settings.json 填入你的配置
```

### 配置文件结构

```json
{
  "openai": {
    "apiKey": "your-api-key-here",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
    "endpoint": "",
    "model": "glm-4.7"
  },
  "project": {
    "rootDir": "./",
    "maxIterations": 3,
    "enableTools": false,
    "permissionLevel": "standard",
    "enableVerification": false,
    "enableMultiAgent": false
  }
}
```

### 配置项说明

#### OpenAI 配置

| 字段 | 说明 | 默认值 | 必填 |
|------|------|--------|------|
| `openai.apiKey` | OpenAI API 密钥 | - | ✅ |
| `openai.baseUrl` | API 基础地址 | `https://open.bigmodel.cn/api/paas/v4` | ❌ |
| `openai.endpoint` | 完整 API 端点（优先级高于 baseUrl） | - | ❌ |
| `openai.model` | 模型名称 | `glm-4.7` | ❌ |

**`endpoint` 字段说明：**

适用于使用其他 OpenAI 兼容格式的 AI 服务。

```json
{
  "openai": {
    "apiKey": "your-api-key",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "model": "gpt-4o-mini"
  }
}
```

如果设置 `endpoint`，系统将直接使用该端点，忽略 `baseUrl` 的自动拼接。

#### 项目配置

| 字段 | 说明 | 默认值 | 可选值 |
|------|------|--------|--------|
| `project.maxIterations` | 最大迭代次数 | `3` | 1-10 |
| `project.enableTools` | 启用工具系统 | `false` | `true`\|`false` |
| `project.permissionLevel` | 权限级别 | `standard` | `read_only`\|`safe`\|`standard`\|`dangerous` |
| `project.enableVerification` | 启用自动验证 | `false` | `true`\|`false` |
| `project.enableMultiAgent` | 启用多代理系统 | `false` | `true`\|`false` |

### 配置优先级

1. **CLI 参数**（最高优先级）
   ```bash
   npm run dev -- "需求" --model glm-4.7 --base-url https://open.bigmodel.cn/api/paas/v4
   ```

2. **项目 settings.json**（`./settings.json`）
   - 仅当前项目生效

3. **全局 settings.json**（`~/.kode/settings.json`）
   - 所有项目生效

4. **.env 文件**（后备方案）
   - 环境变量：`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ENDPOINT`, `OPENAI_MODEL`

5. **默认值**（最低优先级）

## 方式二: .env 文件

如果你更喜欢使用 `.env` 文件：

1. 创建 `.env` 文件：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件：
   ```env
   OPENAI_API_KEY=your-api-key-here
   OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
   # 可选：完整的 API 端点（优先级高于 BASE_URL）
   # OPENAI_ENDPOINT=https://api.openai.com/v1/chat/completions
   OPENAI_MODEL=glm-4.7
   ```

## 常见配置示例

### 使用智谱 AI（默认）

```json
{
  "openai": {
    "apiKey": "your-zhipu-api-key",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
    "model": "glm-4.7"
  }
}
```

### 使用 OpenAI 官方 API

```json
{
  "openai": {
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
    "baseUrl": "https://api.openai.com",
    "model": "gpt-4o-mini"
  }
}
```

### 使用 DeepSeek

```json
{
  "openai": {
    "apiKey": "sk-your-deepseek-key",
    "baseUrl": "https://api.deepseek.com",
    "model": "deepseek-chat"
  }
}
```

### 使用本地 Ollama

```json
{
  "openai": {
    "apiKey": "any-string",  // Ollama 不需要真实 key，但不能为空
    "baseUrl": "http://localhost:11434/v1",
    "model": "llama2"
  }
}
```

### 使用 Azure OpenAI

```json
{
  "openai": {
    "apiKey": "your-azure-api-key",
    "baseUrl": "https://your-resource.openai.azure.com",
    "model": "gpt-4"
  }
}
```

只要是兼容 OpenAI API 格式的服务，都可以通过修改 `baseUrl` 和 `model` 来使用。

## 安全建议

1. **全局配置文件权限**
   ```bash
   chmod 600 ~/.kode/settings.json
   ```

2. **不要将配置文件提交到 Git**
   ```bash
   # 在 .gitignore 中添加
   settings.json
   .env
   ```

3. **使用环境变量用于 CI/CD**
   ```bash
   export OPENAI_API_KEY="your-api-key"
   npm run dev -- "your requirement"
   ```

## 验证配置

运行以下命令验证配置是否正确：

```bash
# 使用默认配置
npm run dev -- "hello world"

# 使用自定义模型
npm run dev -- "hello world" --model glm-4.7

# 查看当前使用的配置
npm run dev -- "hello world" --verbose
```

如果配置正确，你应该看到 AI 开始工作。如果看到错误信息，请检查：
- API Key 是否正确
- Base URL 是否可访问
- 模型名称是否正确
- 网络连接是否正常

## 故障排除

### 问题：找不到 API Key

```
❌ 请在 settings.json 或 .env 中配置 OPENAI_API_KEY
```

**解决方案**：
1. 运行 `npm run init-settings` 创建配置文件
2. 或手动创建 `settings.json` 并填入 API Key
3. 或创建 `.env` 文件并添加 `OPENAI_API_KEY`

### 问题：无法连接到 API

```
Error: fetch failed
```

**解决方案**：
1. 检查 `baseUrl` 是否正确
2. 检查网络连接
3. 如果使用代理，确保代理设置正确
4. 检查 API 服务是否正常运行

### 问题：模型不存在

```
Error: Model 'xxx' does not exist
```

**解决方案**：
1. 检查 `model` 字段是否拼写正确
2. 确认该模型在你的 API 账户下可用
3. 尝试使用其他模型（如 `glm-4.7`）

## 更多帮助

- 查看 [README.md](./README.md) 了解项目详情
- 查看 [CLAUDE.md](./CLAUDE.md) 了解开发文档
