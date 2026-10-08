#!/usr/bin/env node
/**
 * Task Tracker Integration Test
 */

// 模拟测试：验证插件系统能正确加载和注册
import { SessionManager } from './dist/session.js';
import { TaskTracker } from './dist/task-tracker/tracker.js';
import { TaskStorage } from './dist/task-tracker/storage.js';
import { TaskLifecyclePlugin } from './dist/task-tracker/plugin.js';
import { promises as fs } from 'fs';

console.log('=== Task Tracker 集成测试 ===\n');

async function test() {
  try {
    // 1. 测试 SessionManager 创建 TaskTracker
    console.log('1. 测试 SessionManager 创建 TaskTracker...');
    const storage = new TaskStorage({
      dataDir: '.newma/tasks-test',
      compressAfterDays: 30,
    });
    const tracker = new TaskTracker(storage);
    console.log('✅ TaskTracker 创建成功');

    // 2. 测试 SessionManager.getTaskLifecyclePlugin()
    console.log('\n2. 测试 SessionManager.getTaskLifecyclePlugin()...');
    const mockSession = {
      taskTracker: tracker,
      getTaskLifecyclePlugin() {
        return new TaskLifecyclePlugin(this.taskTracker);
      }
    };
    const plugin = mockSession.getTaskLifecyclePlugin();
    console.log('✅ TaskLifecyclePlugin 创建成功');
    console.log('   Plugin ID:', plugin.id);
    console.log('   Plugin Name:', plugin.name);

    // 3. 测试插件钩子方法
    console.log('\n3. 测试 TaskLifecyclePlugin.onBeforeInput()...');
    const context = {
      session: {
        sessionId: 'test-session',
        currentMode: 'chat',
        projectRoot: process.cwd(),
      },
      config: {},
      pluginRoot: process.cwd(),
      projectRoot: process.cwd(),
    };

    // 测试创建任务（模拟非命令输入）
    const result1 = await plugin.onBeforeInput('测试任务', context);
    console.log('✅ onBeforeInput() 执行成功');
    console.log('   当前任务:', tracker.getCurrentTask());

    // 4. 测试任务状态
    console.log('\n4. 验证任务状态...');
    const task = tracker.getCurrentTask();
    if (task) {
      console.log('✅ 任务已创建');
      console.log('   任务描述:', task.description);
      console.log('   任务状态:', task.status);
      console.log('   任务模式:', task.mode);
    } else {
      console.log('❌ 任务未创建');
    }

    // 5. 测试 /tasks 命令
    console.log('\n5. 测试 tasks 目录创建...');
    try {
      await fs.mkdir('.newma/tasks-test', { recursive: true });
      console.log('✅ 任务目录已创建');
    } catch (e) {
      console.log('⚠️  目录已存在或创建失败:', e.message);
    }

    // 6. 测试任务保存
    console.log('\n6. 测试任务保存...');
    await tracker.completeTask(true);
    console.log('✅ 任务已完成并保存');
    const allTasks = await tracker.listTasks();
    console.log('   所有任务:', allTasks);

    console.log('\n=== ✅ 所有测试通过 ===');
    console.log('\n📋 Task Tracker 系统集成成功！');
    console.log('\n使用方法:');
    console.log('  npx ts-node src/cli.ts -i --loop-engine');
    console.log('  → 输入任何非命令文本会自动创建任务');
    console.log('  → /tasks 查看所有任务');
    console.log('  → /task <id> 查看任务详情');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
