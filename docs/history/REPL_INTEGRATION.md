# REPL Integration Guide - Precipitation System

## 当前集成状态

### ✅ 已完成（80%）

1. **Import 和类型导入**
   - `PrecipitationCoordinator`
   - `createPrecipitationCommands`
   - `getPrecipitationConfig`
   - `NewmaConfig`

2. **属性添加**
   - `private precipitationCoordinator?: PrecipitationCoordinator;`

3. **初始化方法**
   - `initializePrecipitationSystem()` - 创建并启动协调器

4. **启动提示**
   - `showDraftsNotification()` - 显示待审批草稿

5. **编译状态**
   - ✅ TypeScript 编译通过

### ⚠️ 待完成（20%）

1. **命令注册** - 需要在 `handleSpecialCommand` 或命令管理器中注册 8 个沉淀命令
2. **优雅关闭** - 在 `/exit` 时调用 `precipitationCoordinator.stop()`

## 快速完成步骤

### 步骤 1: 命令注册（10分钟）

在 `handleSpecialCommand` 方法中添加：

```typescript
// 在 switch 语句中添加
case '/drafts':
  await this.handlePrecipitationCommand('drafts', args);
  break;

case '/approve':
  await this.handlePrecipitationCommand('approve', args);
  break;

case '/reject':
  await this.handlePrecipitationCommand('reject', args);
  break;

case '/view-draft':
  await this.handlePrecipitationCommand('view-draft', args);
  break;

case '/delete-draft':
  await this.handlePrecipitationCommand('delete-draft', args);
  break;

case '/precipitate':
  await this.handlePrecipitationCommand('precipitate', args);
  break;

case '/precipitation-status':
  await this.handlePrecipitationCommand('status', args);
  break;

case '/precipitation-schedule':
  await this.handlePrecipitationCommand('schedule', args);
  break;
```

添加辅助方法：

```typescript
/**
 * 🔥 处理沉淀系统命令
 */
private async handlePrecipitationCommand(command: string, args: string[]): Promise<void> {
  if (!this.precipitationCoordinator) {
    console.log(chalk.yellow('Precipitation system is not available'));
    return;
  }

  const commands = createPrecipitationCommands(this.precipitationCoordinator);
  const cmd = commands.find(c => c.name === `/${command}`);

  if (cmd) {
    const context = {
      session: this.session,
      hookSystem: this.hookSystem,
      args: args,
      rawInput: `/${command} ${args.join(' ')}`,
      userData: new Map(),
    };

    const result = await cmd.handler(context);
    if (!result.success) {
      console.log(chalk.red(`Command failed: ${result.error}`));
    }
  }
}
```

### 步骤 2: 优雅关闭（2分钟）

在 `/exit` 或 `/quit` case 中添加：

```typescript
case '/exit':
case '/quit':
  // 🔥 停止沉淀系统
  if (this.precipitationCoordinator) {
    try {
      await this.precipitationCoordinator.stop();
    } catch (error) {
      console.log(chalk.gray('Precipitation system stopped'));
    }
  }

  // Save history before exiting
  await this.saveHistory();
  this.isClosed = true;
  this.rl.close();
  break;
```

## 测试方法

```bash
# 1. 编译
npm run build

# 2. 启动 REPL
npx ts-node src/repl.ts

# 3. 测试命令
> /precipitation-status
> /drafts
> /precipitate

# 4. 退出
> /exit
```

## 预期行为

1. **启动时**
   - 显示 "⏰ Precipitation system started"
   - 如果有待审批草稿，显示通知

2. **命令执行**
   - 所有 8 个沉淀命令正常工作
   - 显示格式化的输出

3. **退出时**
   - 优雅停止调度器
   - 清理资源

## 下一步

完成命令注册和优雅关闭后，系统即可使用。
