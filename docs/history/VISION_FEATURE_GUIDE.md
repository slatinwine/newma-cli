# Newma 视觉功能使用指南

## 概述

Newma 现在支持多模态 AI 功能，可以让 AI "看"并分析图片！这个功能集成了 OpenAI 和 GLM 的视觉模型，让您可以：

- 使用 `@filename.png` 语法引用图片
- 将图片粘贴到终端（部分支持）
- 让 AI 描述、分析、解释图片内容
- 在截图上标注和提问

## 快速开始

### 1. 启用视觉功能

#### 方法 A：使用命令行参数

```bash
# 启用视觉功能并指定视觉模型
npx newma-cli -i --enable-vision --vision-model gpt-4o

# GLM 用户
npx newma-cli -i --enable-vision --vision-model glm-4v
```

#### 方法 B：使用环境变量

在 `.env` 文件中添加：

```bash
ENABLE_VISION=true
OPENAI_VISION_MODEL=gpt-4o  # 或 glm-4v
```

#### 方法 C：使用配置文件

在 `settings.json` 中添加：

```json
{
  "openai": {
    "visionModel": "gpt-4o"
  },
  "project": {
    "enableVision": true
  }
}
```

### 2. 使用图片引用

在 REPL 中输入：

```
[newma] ❯ @screenshot.png 请描述这个界面
```

Newma 会：
1. 检测 `@screenshot.png` 引用
2. 加载图片并转换为 base64
3. 发送到视觉模型（gpt-4o 或 glm-4v）
4. 返回 AI 的分析结果

## 使用示例

### 示例 1：分析界面截图

```bash
[newma] ❯ @login-page.png 这个登录界面有什么问题？

📷 Detected 1 image(s)
📷 Loaded image: login-page.png (~1500 tokens)
📊 Total image tokens: ~1500
🔭 Using vision model: gpt-4o
📤 Sending message to AI...

AI 分析：
这个登录界面存在以下问题：
1. 密码输入框没有显示/隐藏密码的选项
2. "忘记密码"链接位置不明显
3. 缺少"保持登录"选项
4. 移动端响应式布局可能有问题...
```

### 示例 2：多图片对比

```bash
[newma] ❯ @design-v1.png @design-v2.png 这两个设计有什么不同？

📷 Detected 2 image(s)
📷 Loaded image: design-v1.png (~1200 tokens)
📷 Loaded image: design-v2.png (~1350 tokens)
📊 Total image tokens: ~2550

AI 分析：
主要差异：
- v2 将导航栏从左侧移到了顶部
- v2 添加了深色模式支持
- v2 的配色方案更现代...
```

### 示例 3：代码截图重构

```bash
[newma] ❯ @legacy-code.png 请帮我重构这段代码，使用 TypeScript

📷 Detected 1 image(s)

AI 重构后的代码：
```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  async getUserById(id: number): Promise<User | null> {
    // ...
  }
}
```
```

### 示例 4：错误调试

```bash
[newma] ❯ @error-screenshot.png 这个错误怎么解决？

📷 Detected 1 image(s)

AI 建议：
这是一个 React TypeError，常见原因：
1. props 未正确传递
2. 组件未正确导入
3. TypeScript 类型不匹配

解决方案：
...
```

## 支持的图片格式

- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- GIF (`.gif`)
- WebP (`.webp`)
- BMP (`.bmp`)

## 配置选项

### 视觉模型选择

根据您的 API 提供商选择：

| 提供商 | 推荐模型 | 支持情况 |
|--------|----------|----------|
| OpenAI | `gpt-4o` | ✅ 完全支持 |
| 智谱 AI | `glm-4v` | ✅ 完全支持 |
| 其他 | `gpt-4o` | ⚠️  需兼容性 |

### 图片大小限制

- 单张图片最大：10MB
- 推荐尺寸：≤ 2048x2048 像素
- 超过限制的图片会显示警告

## 高级用法

### 结合其他功能

```bash
# 1. 视觉 + 规划
[newma] ❯ /plan @mockup.png 实现这个设计

# 2. 视觉 + 执行
[newma] ❯ /do @bug-screenshot.png 修复这个 bug

# 3. 纯聊天模式
[newma] ❯ @diagram.png 解释这个架构图
```

### 项目上下文

图片路径相对于项目根目录：

```
my-project/
├── screenshots/
│   ├── login.png
│   └── dashboard.png
└── src/

# 在项目根目录运行：
[newma] ❯ @screenshots/login.png 分析这个登录页
```

## 技术细节

### Token 估算

图片会消耗大量 tokens：

- 小图片（<500KB）：~500-1000 tokens
- 中等图片（500KB-2MB）：~1000-3000 tokens
- 大图片（>2MB）：~3000-10000+ tokens

**建议**：压缩图片后再发送以节省成本。

### 消息格式

多模态消息使用 OpenAI 标准格式：

```json
{
  "role": "user",
  "content": [
    {
      "type": "image_url",
      "image_url": {
        "url": "data:image/png;base64,iVBORw0KGgo..."
      }
    },
    {
      "type": "text",
      "text": "请描述这个图片"
    }
  ]
}
```

### 函数调用限制

⚠️ **重要**：当发送图片时，函数调用（Function Calling）会自动禁用。

因为大多数视觉模型不支持函数调用。这是预期行为。

## 故障排查

### 问题 1：图片未找到

```
⚠️  Image not found: screenshot.png, skipping...
```

**解决方案**：
- 确保图片路径正确
- 使用相对于项目根目录的路径
- 检查文件是否存在

### 问题 2：视觉模型不支持

```
❌ Error: Model 'glm-4.7' does not support vision
```

**解决方案**：
- 使用 `--vision-model` 指定支持的视觉模型
- OpenAI: `gpt-4o`
- GLM: `glm-4v`

### 问题 3：Token 超限

```
⚠️  Image file too large: 15728640 bytes (max: 10485760)
```

**解决方案**：
- 压缩图片（推荐使用 TinyPNG 或类似工具）
- 调整图片尺寸至 ≤ 2048x2048
- 转换为更高效的格式（如 WebP）

## 性能优化建议

1. **使用适当的图片格式**
   - PNG: 适合截图、界面设计
   - JPEG: 适合照片
   - WebP: 最佳压缩比

2. **控制图片尺寸**
   - 界面截图：通常 1280x720 或 1920x1080 已足够
   - 移动端截图：通常 ≤ 1000px 宽度
   - 避免发送 4K 分辨率图片

3. **批量处理**
   - 一次发送多张相关图片比多次发送更高效
   - 但注意总 token 消耗

## 未来计划

- [ ] 剪贴板粘贴检测（完整支持）
- [ ] 图片自动压缩（使用 sharp 库）
- [ ] 图片历史缓存（避免重复加载）
- [ ] OCR 文字识别增强
- [ ] 视频帧分析

## 反馈与贡献

如有问题或建议，请：

1. 提交 Issue：https://github.com/your-repo/newma/issues
2. 加入讨论：https://github.com/your-repo/newma/discussions
3. 贡献代码：欢迎 PR！

---

**最后更新**：2026-01-25
**版本**：v3.4.0+
