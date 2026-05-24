# 智谱 AI 迁移经验总结

本文档记录了从 OpenAI 兼容格式迁移到智谱 AI (Zhipu AI) GLM-5 模型的经验和解决方案。

## 📋 目录

- [配置差异](#配置差异)
- [常见问题](#常见问题)
- [解决方案](#解决方案)
- [代码示例](#代码示例)

## 🔧 配置差异

### 1. API Endpoint

**OpenAI 标准格式：**
```bash
OPENAI_BASE_URL=https://api.openai.com
# 实际 endpoint: https://api.openai.com/v1/chat/completions
```

**智谱 AI 格式：**
```bash
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
# 实际 endpoint: https://open.bigmodel.cn/api/paas/v4/chat/completions
```

⚠️ **注意**: 智谱 AI 的 baseUrl 不包含 `/v4` 后缀，而是在 `api/paas` 路径下。

### 2. 模型名称

```bash
OPENAI_MODEL=glm-5
```

智谱 AI 支持的模型：
- `glm-5` - 最新一代模型（推荐）
- `glm-4.7` - 上一代推理模型
- `glm-4-plus` - 增强版
- `glm-4` - 标准版
- `glm-4-flash` - 快速版
- `glm-4-air` - 轻量版

## 🐛 常见问题

### 问题 1: 404 Not Found

**错误信息：**
```
OpenAI API error: 404 - {"path":"/v4/v1/chat/completions"}
```

**原因：**
- baseUrl 配置错误，导致路径拼接出现重复（`/v4/v1/chat/completions`）
- 智谱 AI 的正确 baseUrl 是 `https://open.bigmodel.cn/api/paas/v4`

**解决方案：**
```typescript
// src/config.ts
const baseUrl = settings?.openai?.baseUrl ?? envBaseUrl ?? 'https://open.bigmodel.cn/api/paas/v4';
```

### 问题 2: 响应内容为空

**错误信息：**
```
AI response does not contain valid JSON
Could not extract message content from API response
```

**原因：**
- 智谱 AI GLM-5/GLM-4.7 使用推理模式，响应结构与标准 OpenAI 不同
- 内容存储在 `reasoning_content` 字段，而不是 `content` 字段

**智谱 AI 响应结构：**
```json
{
  "choices": [{
    "message": {
      "content": "",                              // 空的
      "reasoning_content": "实际的 AI 回复内容"   // 真实内容
    }
  }],
  "usage": {
    "completion_tokens": 4095,
    "completion_tokens_details": {
      "reasoning_tokens": 4081  // 推理 token 数
    }
  }
}
```

**解决方案：**
```typescript
// src/ai.ts
const message = data.choices?.[0]?.message;
const rawMessage: string =
  message?.reasoning_content ||  // 优先：智谱 AI 推理字段
  message?.content ||            // 回退：标准 OpenAI 字段
  '';
```

## ✅ 解决方案详解

### 1. 正确的配置文件

**.env 文件：**
```bash
OPENAI_API_KEY=your-zhipu-api-key
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-5
```

**settings.json：**
```json
{
  "openai": {
    "apiKey": "your-zhipu-api-key",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
    "model": "glm-5"
  }
}
```

### 2. 兼容两种格式的代码

**响应提取（兼容 OpenAI 和智谱 AI）：**
```typescript
export function extractMessageContent(data: any): string {
  const message = data.choices?.[0]?.message;

  // 优先级 1: 智谱 AI 推理内容
  if (message?.reasoning_content) {
    return message.reasoning_content;
  }

  // 优先级 2: 标准 OpenAI 内容
  if (message?.content) {
    return message.content;
  }

  // 如果都没有，抛出错误
  throw new Error('Could not extract message content from API response');
}
```

**Token 统计（兼容 OpenAI 和智谱 AI）：**
```typescript
export function extractUsage(data: any) {
  const usage = data.usage;

  if (!usage) return undefined;

  // 智谱 AI 可能有额外的 reasoning_tokens 字段
  return {
    prompt_tokens: usage.prompt_tokens || 0,
    completion_tokens: usage.completion_tokens || 0,
    total_tokens: usage.total_tokens || 0,
    reasoning_tokens: usage.completion_tokens_details?.reasoning_tokens || 0
  };
}
```

### 3. 错误处理和调试

**添加详细的错误信息：**
```typescript
if (!rawMessage) {
  console.error('❌ Failed to extract message from API response');
  console.error('❌ Response structure:');
  console.error(JSON.stringify(data, null, 2));
  throw new Error('Could not extract message content from API response');
}

// JSON 解析错误处理
const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  console.error('❌ AI Response Validation Error');
  console.error('❌ Expected JSON but got:');
  console.error('--- Raw Response Start ---');
  console.error(rawMessage);
  console.error('--- Raw Response End ---');
  throw new Error('AI response does not contain valid JSON');
}
```

## 📊 性能对比

### Token 使用对比

**OpenAI GPT-4o-mini：**
```
prompt_tokens: ~10,000
completion_tokens: ~500
total_tokens: ~10,500
```

**智谱 AI GLM-5（推理模式）：**
```
prompt_tokens: ~198,000  (包含项目文件)
completion_tokens: 4,095
  ├─ reasoning_tokens: 4,081  (99.6%)
  └─ answer_tokens: 14        (0.4%)
total_tokens: ~202,000
```

⚠️ **注意**: 智谱 AI GLM-5/GLM-4.7 的推理模式会产生大量推理 token，适合复杂任务。简单任务可以考虑使用 `glm-4-flash` 或 `glm-4-air` 以降低成本。

### 成本考虑

**模型选择建议：**

| 模型 | 适用场景 | 特点 |
|------|----------|------|
| `glm-5` | 复杂推理、代码生成 | 最新一代，推理能力最强 |
| `glm-4.7` | 复杂推理、代码生成 | 上一代推理模型，成本较高 |
| `glm-4-plus` | 常规开发任务 | 平衡性能和成本 |
| `glm-4-flash` | 快速响应 | 速度快，成本低 |
| `glm-4-air` | 轻量任务 | 最轻量，成本最低 |

## 🚀 最佳实践

### 1. 环境变量配置

```bash
# .env
# 必填
OPENAI_API_KEY=your-zhipu-api-key

# 可选（使用默认值即可）
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-5

# 完整 endpoint（优先级最高，用于自定义兼容服务）
# OPENAI_ENDPOINT=https://custom-endpoint.com/v1/chat/completions
```

### 2. 动态模型选择

```typescript
// 根据任务复杂度选择模型
function selectModelForTask(complexity: 'simple' | 'medium' | 'complex'): string {
  const modelMap = {
    simple: 'glm-4-flash',    // 简单任务
    medium: 'glm-4-plus',     // 中等任务
    complex: 'glm-5'          // 复杂任务
  };
  return modelMap[complexity];
}
```

### 3. 兼容性检查

```typescript
// 检测是否为智谱 AI 响应
function isZhipuAIResponse(data: any): boolean {
  return !!data.choices?.[0]?.message?.reasoning_content;
}

// 兼容处理
function handleResponse(data: any) {
  if (isZhipuAIResponse(data)) {
    console.log('✅ Using Zhipu AI reasoning content');
  } else {
    console.log('✅ Using standard OpenAI content');
  }
  return extractMessageContent(data);
}
```

## 📝 检查清单

迁移到智谱 AI 时的检查清单：

- [ ] 更新 `.env` 文件中的 `OPENAI_BASE_URL`
- [ ] 更新 `settings.json` 中的 baseUrl
- [ ] 确认 `OPENAI_API_KEY` 是智谱 AI 的 API key
- [ ] 修改响应解析代码支持 `reasoning_content`
- [ ] 更新文档中的 endpoint 说明
- [ ] 测试 API 连接（发送简单请求）
- [ ] 检查响应格式是否正确
- [ ] 验证 token 统计是否准确
- [ ] 测试复杂任务（多轮对话）
- [ ] 根据需求选择合适的模型

## 🔗 相关资源

- [智谱 AI 开放平台](https://open.bigmodel.cn/)
- [GLM-4 API 文档](https://open.bigmodel.cn/dev/api)
- [模型列表和定价](https://open.bigmodel.cn/pricing)

## 📅 更新日志

- **2026-02-13**: 更新默认模型为 GLM-5
  - 更新 .env.example 中的默认模型
  - 更新 src/config.ts 中的默认模型
  - 更新文档中的模型说明
- **2025-01-17**: 初始版本，记录从 OpenAI 格式迁移到智谱 AI GLM-4.7 的经验
- 主要变更：
  - 修复 endpoint 配置（`/api/paas/v4`）
  - 添加 `reasoning_content` 字段支持
  - 实现兼容两种格式的响应解析
  - 添加详细的错误处理和调试信息

## 💡 经验总结

1. **不要假设所有 OpenAI 兼容 API 都完全一致**
   - 智谱 AI 虽然兼容 OpenAI 格式，但推理模型有额外字段
   - 始终检查实际响应结构

2. **使用详细的错误日志**
   - 输出完整响应结构有助于快速定位问题
   - JSON 格式化输出比字符串更易读

3. **向后兼容很重要**
   - 优先检查新字段（`reasoning_content`）
   - 回退到标准字段（`content`）
   - 保持代码灵活性，支持多种服务

4. **文档是关键**
   - 记录所有遇到的问题和解决方案
   - 提供代码示例和最佳实践
   - 更新相关文档（README、SETTINGS.md）

5. **测试驱动**
   - 从简单请求开始测试
   - 逐步增加复杂度
   - 验证边界情况

---

**文档版本**: 1.0.0
**最后更新**: 2025-01-17
**维护者**: Newma (牛码) Development Team
