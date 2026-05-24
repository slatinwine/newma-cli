const { TaskStorage } = require('./dist/task-tracker/storage.js');

async function testSave() {
  const storage = new TaskStorage({
    dataDir: '/tmp/test-tasks-save',
    compressAfterDays: 30,
    compressionLevel: 9,
  });

  const task = {
    id: 'test-save-1',
    sessionId: 'test-save-1',
    status: 'pending',
    mode: 'execute',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    projectRoot: '/tmp/test',
    requirement: '测试保存',
    reasoning: {},
    execution: {
      actions: [],
      summary: { total: 0, succeeded: 0, failed: 0 }
    },
    metadata: {
      duration: 0,
      status: 'pending'
    }
  };

  console.log('Testing save 1...');
  await storage.save(task);

  console.log('Testing save 2 (update)...');
  await storage.save({ ...task, status: 'completed' });

  console.log('Testing save 3 (another update)...');
  await storage.save({ ...task, status: 'failed' });

  // Load and check
  const loaded = await storage.load('test-save-1');
  console.log('\nLoaded task:');
  console.log(JSON.stringify(loaded, null, 2));

  // Read raw file
  const fs = require('fs');
  const raw = fs.readFileSync('/tmp/test-tasks-save/test-save-1.json', 'utf8');
  console.log('\nRaw file content:');
  console.log(raw);
  console.log('\nRaw file length:', raw.length);

  // Check for extra braces
  const lines = raw.split('\n');
  console.log('\nLast 5 lines:');
  lines.slice(-5).forEach((line, i) => {
    const lineNum = lines.length - 5 + i + 1;
    console.log(`${lineNum}: ${JSON.stringify(line)}`);
  });
}

testSave().catch(console.error);
