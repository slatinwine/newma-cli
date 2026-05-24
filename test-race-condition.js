const { TaskStorage } = require('./dist/task-tracker/storage.js');

async function testRaceCondition() {
  const storage = new TaskStorage({
    dataDir: '/tmp/test-race',
    compressAfterDays: 30,
    compressionLevel: 9,
  });

  const task = {
    id: 'race-test',
    sessionId: 'race-test',
    status: 'pending',
    mode: 'execute',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    projectRoot: '/tmp/test',
    requirement: '竞态条件测试',
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

  console.log('Testing rapid consecutive saves without await...');

  // Simulate the bug: calling save without await
  storage.save(task);
  storage.save({ ...task, status: 'running' });
  storage.save({ ...task, status: 'completed' });

  // Wait a bit for all saves to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // Read raw file
  const fs = require('fs');
  const raw = fs.readFileSync('/tmp/test-race/race-test.json', 'utf8');

  console.log('\nRaw file:');
  console.log(raw);
  console.log('\nFile length:', raw.length);

  // Count braces at end
  const trimmed = raw.trimEnd();
  const trailingBraces = raw.slice(trimmed.length);
  console.log('Trailing characters (after last }):', JSON.stringify(trailingBraces));

  // Validate
  try {
    JSON.parse(raw);
    console.log('✅ JSON is valid');
  } catch (e) {
    console.log('❌ JSON is invalid:', e.message);
  }
}

testRaceCondition().catch(console.error);
