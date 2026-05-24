# 用户侧写自动更新功能 - 实现指南

## 📋 功能描述

在聊天模式中，系统应该定期（例如每 5 次对话）分析用户的输入，更新用户侧写文件（`用户侧写.md`），以便 AI 能够更好地适应用户的偏好。

## 🎯 需要实现的功能

### 1. 追踪用户输入

在 `SessionManager` 中添加用户输入追踪：

```typescript
// src/session.ts
export class SessionManager {
  private userInputs: string[] = [];  // 存储用户输入
  private readonly PROFILE_UPDATE_INTERVAL = 5;  // 每5次更新一次

  recordUserInput(input: string): void {
    this.userInputs.push(input);
  }

  shouldUpdateProfile(): boolean {
    return this.userInputs.length >= this.PROFILE_UPDATE_INTERVAL;
  }

  getUserInputs(): string[] {
    return this.userInputs;
  }

  clearUserInputs(): void {
    this.userInputs = [];
  }
}
```

### 2. 触发侧写更新

在 `REPLManager.chatMode()` 中添加更新逻辑：

```typescript
// src/repl.ts
private async chatMode(userMessage: string): Promise<void> {
  // 记录用户输入
  this.session.recordUserInput(userMessage);

  // 检查是否需要更新用户侧写
  if (this.session.shouldUpdateProfile()) {
    console.log(chalk.cyan('📊 正在更新用户侧写...\n'));

    const userProfile = await this.generateUserProfile();
    await this.updateUserProfileFile(userProfile);

    // 清空输入记录
    this.session.clearUserInputs();

    console.log(chalk.green('✅ 用户侧写已更新！\n'));
  }

  // ... 继续正常的聊天逻辑
}
```

### 3. 生成用户侧写

添加生成用户侧写的方法：

```typescript
// src/repl.ts
private async generateUserProfile(): Promise<string> {
  const userInputs = this.session.getUserInputs();
  const inputsText = userInputs.join('\n');

  const prompt = `请分析以下用户对话历史，提取用户偏好，生成简洁的用户侧写（100-200字）：

用户对话历史：
${inputsText}

请生成 markdown 格式的侧写，包含以下字段：
- ## 语言偏好
- ## 交流风格
- ## 兴趣领域
- ## 其他特征

直接输出侧写内容，不要分析过程。`;

  // 调用 AI 生成侧写
  const config = this.session.getConfig();
  const { chatAI } = await import('./ai');

  const profile = await chatAI(
    config,
    prompt,
    undefined,  // signal
    undefined,  // 不使用当前侧写，避免循环
    undefined,  // toolRegistry
    undefined   // toolExecutor
  );

  return profile;
}
```

### 4. 更新侧写文件

添加更新文件的方法：

```typescript
// src/repl.ts
private async updateUserProfileFile(content: string): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');

  const profilePath = path.join(
    this.session.getProjectRoot(),
    this.session['PROFILE_FILE']  // '用户侧写.md'
  );

  const timestamp = new Date().toISOString();
  const header = `<!-- 最后更新: ${timestamp} -->\n\n`;

  await fs.writeFile(profilePath, header + content, 'utf-8');
}
```

## 🧪 测试步骤

1. **手动测试**：
```bash
# 启动交互模式
npx newma-cli -i

# 进行 5 次对话
> 你好
> 今天天气怎么样
> 小米股价
> 推荐一本书
> 帮我写个函数

# 第 5 次对话后应该自动更新用户侧写
```

2. **验证侧写文件**：
```bash
cat 用户侧写.md
```

3. **验证效果**：
   - 继续对话，观察 AI 是否适应了你的偏好
   - 例如：如果你一直用中文，AI 应该继续用中文回复

## 📊 当前状态

### ✅ 已完成
- [x] 聊天模式提示词支持用户侧写
- [x] AI 在聊天时自动读取用户侧写
- [x] AI 根据侧写调整语言和风格
- [x] 用户侧写文件格式定义（`用户侧写.md`）
- [x] 自动追踪用户输入（SessionManager）
- [x] 定期触发侧写更新（每 3 次对话）
- [x] AI 分析输入生成新侧写（generateUserProfile）
- [x] 保存更新后的侧写文件（updateUserProfileFile）

### ⏳ 待实现
- [ ] 手动触发侧写更新命令（/update-profile）
- [ ] 侧写版本历史
- [ ] 侧写差异对比
- [ ] 侧写确认机制（用户确认后才更新）

## 🎯 实现优先级

**✅ 已完成**（核心功能）：
1. ✅ 在 `SessionManager` 添加输入追踪
2. ✅ 在 `REPLManager.chatMode()` 添加更新触发逻辑
3. ✅ 实现 `generateUserProfile()` 方法
4. ✅ 实现 `updateUserProfileFile()` 方法

**中优先级**（优化）：
5. ⏳ 添加更智能的侧写生成逻辑（避免覆盖重要信息）
6. ⏳ 支持手动触发侧写更新（例如 `/update-profile` 命令）

**低优先级**（增强）：
7. ⏳ 侧写版本历史
8. ⏳ 侧写差异对比
9. ⏳ 侧写确认机制（用户确认后才更新）

## 💡 实现建议

1. **✅ 渐进式实现**：先实现基本的每 3 次更新，再优化生成逻辑
2. **✅ 用户控制**：允许用户禁用自动更新或调整更新频率（通过修改 `PROFILE_UPDATE_INTERVAL`）
3. **⏳ 智能合并**：不要完全覆盖旧侧写，而是合并新旧信息
4. **✅ 透明性**：显示侧写更新的提示（"📊 正在更新用户侧写..."），让用户知道发生了什么

## 📝 相关文件

- `src/session.ts` - SessionManager 类
- `src/repl.ts` - REPLManager 类
- `src/ai.ts` - chatAI() 函数
- `prompts/mode-chat.md` - 聊天模式提示词
- `用户侧写.md` - 用户侧写文件（自动生成）

## 🔗 参考资源

- [Phase 6.1 - User Profiling](./PHASE6_SUMMARY.md) - 原始用户侧写设计文档
- [AI Assistant Guide](./AI_ASSISTANT_GUIDE.md) - AI 工作指南
- [CLAUDE.md](./CLAUDE.md) - 项目文档

---

**最后更新**: 2026-01-29
**状态**: ✅ 核心功能已完成
**版本**: v1.0 - 自动更新侧写（每 3 次对话）
