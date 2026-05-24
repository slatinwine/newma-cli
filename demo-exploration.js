#!/usr/bin/env node
/**
 * 自主探索功能演示 - 架构展示
 */

const chalk = require('chalk');

console.log(chalk.cyan.bold('\n🚀 Newma 自主探索定时任务系统\n'));

console.log(chalk.yellow.bold('📦 核心组件'));
console.log(chalk.white('─'.repeat(60)));

const components = [
  {
    name: 'AutonomousExplorer',
    file: 'src/agents/autonomous-explorer.ts',
    lines: 800,
    desc: 'AI自主规划Agent（5阶段流程）'
  },
  {
    name: 'ExplorationLogManager',
    file: 'src/memory/exploration-log.ts',
    lines: 350,
    desc: '日志管理系统（JSON存储）'
  },
  {
    name: 'MemoryScheduler (扩展)',
    file: 'src/memory/scheduler.ts',
    lines: +100,
    desc: '添加4小时定时任务支持'
  },
  {
    name: 'ExplorationScheduler',
    file: 'gateway/src/services/ExplorationScheduler.ts',
    lines: 380,
    desc: 'Gateway调度器服务（监控）'
  }
];

components.forEach((comp, i) => {
  console.log(chalk.green(`${i + 1}. ${comp.name}`));
  console.log(chalk.gray(`   文件: ${comp.file}`));
  console.log(chalk.gray(`   代码: ${comp.lines}+ 行`));
  console.log(chalk.gray(`   功能: ${comp.desc}`));
  console.log('');
});

console.log(chalk.yellow.bold('\n🤖 AI自主规划流程（5阶段）'));
console.log(chalk.white('─'.repeat(60)));

const stages = [
  { icon: '📊', name: '状态收集', desc: '分析系统、代码、依赖状态' },
  { icon: '🧠', name: '计划生成', desc: 'AI生成探索计划（JSON格式）' },
  { icon: '🔍', name: '信息搜索', desc: '网络/本地资源搜索' },
  { icon: '⚙️ ', name: '任务执行', desc: '按优先级执行操作' },
  { icon: '📝', name: '结果评估', desc: '生成洞察和建议' }
];

stages.forEach((stage, i) => {
  console.log(chalk.cyan(`  ${stage.icon} 阶段 ${i + 1}: ${stage.name}`));
  console.log(chalk.gray(`     ${stage.desc}`));
  console.log('');
});

console.log(chalk.yellow.bold('\n🎯 四大探索领域'));
console.log(chalk.white('─'.repeat(60)));

const domains = [
  { icon: '🔧', name: '系统维护', actions: ['健康检查', '依赖更新', '缓存清理'] },
  { icon: '💻', name: '代码分析', actions: ['代码质量', '模式检测', '问题识别'] },
  { icon: '🌐', name: '知识探索', actions: ['最新技术', '最佳实践', '学习机会'] },
  { icon: '📁', name: '工作区优化', actions: ['文件组织', '文档生成', '项目优化'] }
];

domains.forEach((domain, i) => {
  console.log(chalk.magenta(`  ${domain.icon} ${domain.name}`));
  console.log(chalk.gray(`     ${domain.actions.join(' • ')}`));
  console.log('');
});

console.log(chalk.yellow.bold('\n⏰ 定时执行机制'));
console.log(chalk.white('─'.repeat(60)));

console.log(chalk.cyan('  Cron 表达式:  0 */4 * * *'));
console.log(chalk.gray('  执行时间:    00:00, 04:00, 08:00, 12:00, 16:00, 20:00'));
console.log(chalk.gray('  失败重试:    30分钟后自动重试'));
console.log(chalk.gray('  日志保留:    30天自动清理'));
console.log('');

console.log(chalk.yellow.bold('\n📡 WebSocket监控API'));
console.log(chalk.white('─'.repeat(60)));

const apis = [
  { method: 'exploration.status', desc: '获取当前系统状态' },
  { method: 'exploration.history', desc: '获取最近50条探索记录' },
  { method: 'exploration.get', desc: '获取单个任务详情' },
  { method: 'exploration.stats', desc: '获取统计信息' }
];

apis.forEach((api, i) => {
  console.log(chalk.green(`  ${api.method}`));
  console.log(chalk.gray(`     ${api.desc}`));
  console.log('');
});

console.log(chalk.yellow.bold('\n💾 数据存储'));
console.log(chalk.white('─'.repeat(60)));

console.log(chalk.cyan('  Kode CLI 日志:'));
console.log(chalk.gray('  ~/.kode/exploration-logs/'));
console.log(chalk.gray('  ├── 2026-02-05/'));
console.log(chalk.gray('  │   ├── task-1234567890-abc123.json'));
console.log(chalk.gray('  │   └── task-1234567891-def456.json'));
console.log(chalk.gray('  └── exploration-index.json'));
console.log('');

console.log(chalk.cyan('  Gateway 数据库:'));
console.log(chalk.gray('  gateway/database/gateway.db'));
console.log(chalk.gray('  表: exploration_tasks'));
console.log('');

console.log(chalk.yellow.bold('\n⚙️ 配置示例 (settings.json)'));
console.log(chalk.white('─'.repeat(60)));

const config = {
  exploration: {
    enabled: true,
    schedule: '0 */4 * * *',
    domains: [
      'system_maintenance',
      'code_analysis',
      'knowledge_exploration',
      'workspace_optimization'
    ],
    maxActionsPerDomain: 3,
    actionTimeout: 30000,
    logRetentionDays: 30,
    maxLogSize: 100
  }
};

console.log(JSON.stringify(config, null, 2));
console.log('');

console.log(chalk.yellow.bold('\n🚀 使用方式'));
console.log(chalk.white('─'.repeat(60)));

console.log(chalk.cyan('  方式1: 守护进程（推荐）'));
console.log(chalk.gray('  $ cd /Users/mac/kode'));
console.log(chalk.gray('  $ npm run daemon'));
console.log('');

console.log(chalk.cyan('  方式2: Gateway监控'));
console.log(chalk.gray('  $ cd /Users/mac/mobilenewma/gateway'));
console.log(chalk.gray('  $ npm start'));
console.log(chalk.gray('  # 移动端连接: ws://localhost:18789'));
console.log('');

console.log(chalk.cyan('  方式3: 手动触发'));
console.log(chalk.gray('  $ npx ts-node test-exploration.ts'));
console.log('');

console.log(chalk.yellow.bold('\n📊 预期输出示例'));
console.log(chalk.white('─'.repeat(60)));

console.log(chalk.cyan('  🤖 [Autonomous Explorer] Task task-1738756800-xyz789 started'));
console.log('');
console.log(chalk.cyan('  📊 [Stage 1/5] Collecting system state...'));
console.log(chalk.green('  ✓ Collected system state'));
console.log('');
console.log(chalk.cyan('  🧠 [Stage 2/5] Generating exploration plan...'));
console.log(chalk.green('  ✓ Generated 12 actions across 4 domains'));
console.log('');
console.log(chalk.cyan('  🔍 [Stage 3/5] Searching for relevant information...'));
console.log(chalk.green('  ✓ No search queries to process'));
console.log('');
console.log(chalk.cyan('  ⚙️  [Stage 4/5] Executing exploration actions...'));
console.log(chalk.gray('    [system_maintenance] Check system health'));
console.log(chalk.green('      ✓ Completed in 1234ms'));
console.log(chalk.gray('    [code_analysis] Scan for potential issues'));
console.log(chalk.green('      ✓ Completed in 2345ms'));
console.log('');
console.log(chalk.cyan('  📝 [Stage 5/5] Evaluating results...'));
console.log(chalk.green('  ✓ Execution completed: 10 succeeded, 2 failed'));
console.log('');
console.log(chalk.green.bold('  ✅ Task completed in 1m 23s'));
console.log('');
console.log(chalk.yellow('  📊 Exploration Summary:'));
console.log(chalk.gray('     Total Actions: 12'));
console.log(chalk.gray('     Completed: 10'));
console.log(chalk.gray('     Failed: 2'));
console.log(chalk.gray('     Duration: 1m 23s'));
console.log('');
console.log(chalk.yellow('  💡 Key Insights:'));
console.log(chalk.gray('     1. System is healthy with good resource usage'));
console.log(chalk.gray('     2. Found 3 potential code quality issues'));
console.log(chalk.gray('     3. 2 dependencies are outdated'));
console.log('');
console.log(chalk.yellow('  📝 Recommendations:'));
console.log(chalk.gray('     1. Update outdated dependencies (lodash, express)'));
console.log(chalk.gray('     2. Fix code quality issues in src/utils/'));
console.log(chalk.gray('     3. Consider adding more unit tests'));
console.log('');

console.log(chalk.green.bold('\n✅ 系统已就绪！\n'));

console.log(chalk.white('📚 详细文档: /Users/mac/AUTONOMOUS_EXPLORATION_GUIDE.md\n'));
