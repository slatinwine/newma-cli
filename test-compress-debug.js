const { createTaskTracker } = require('./dist/task-tracker/index.js');

async function testCompression() {
  console.log('🧪 Testing task compression...\n');

  const { tracker, storage } = await createTaskTracker('/Users/mac/kode');

  // 列出当前所有任务
  console.log('Current tasks:');
  const tasks = await storage.list();
  tasks.forEach(t => {
    console.log(`  - ${t.id}: ${t.requirement} (${Math.round(Date.now() - new Date(t.createdAt).getTime()) / 1000}s old)`);
  });

  // 强制压缩（修改压缩阈值）
  console.log('\n🔧 Forcing compression by setting age threshold to 0...');
  const originalTasks = await storage.list();

  // 手动修改压缩阈值
  storage.compressAfterDays = 0;

  console.log('\n🗜️  Running compression...');
  const stats = await storage.compressOldTasks();

  console.log('\n📊 Compression stats:');
  console.log(`  Compressed: ${stats.compressedCount} tasks`);
  console.log(`  Original size: ${stats.originalSize} bytes`);
  console.log(`  Compressed size: ${stats.compressedSize} bytes`);
  console.log(`  Reduction: ${stats.reduction.toFixed(1)}%`);
  console.log(`  Duration: ${stats.duration}ms`);

  // 列出压缩后的文件
  const fs = require('fs');
  console.log('\n📁 Files after compression:');
  const files = fs.readdirSync('.memo/tasks');
  files.forEach(f => {
    const stats = fs.statSync(`.memo/tasks/${f}`);
    console.log(`  - ${f} (${stats.size} bytes)`);
  });
}

testCompression().catch(console.error);
