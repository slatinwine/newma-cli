/**
 * Simple test script for event sources
 */

import {
  createFileWatcherSource,
  createHTTPSource,
} from './src/loop/event';

async function testFileWatcher() {
  console.log('\n📁 Testing File Watcher Event Source');
  console.log('═'.repeat(50));

  const watcher = createFileWatcherSource({
    watchPath: './src/loop/event',
    recursive: false,
    debounceMs: 100,
  });

  watcher.start();

  console.log('✅ File watcher started');
  console.log('👀 Watching ./src/loop/event for changes...');
  console.log('✏️  Try editing a file in that directory (10 second test)\n');

  // Test for 10 seconds
  const endTime = Date.now() + 10000;
  let eventCount = 0;

  while (Date.now() < endTime) {
    const event = await watcher.pollNext();
    if (event && event.type === 'focus') {
      eventCount++;
      const fileEvent = event.data as any;
      console.log(`📝 Event ${eventCount}: ${fileEvent.type} - ${fileEvent.path}`);
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  watcher.dispose();
  console.log(`\n✅ Test complete. Received ${eventCount} events.\n`);
}

async function testHTTPServer() {
  console.log('\n🌐 Testing HTTP Event Source');
  console.log('═'.repeat(50));

  const httpSource = createHTTPSource({
    port: 3456,
    cors: { enabled: true },
  });

  await httpSource.start();

  console.log(`✅ HTTP server started on ${httpSource.getServerURL()}`);
  console.log('\n📥 Test with curl (5 second test):');
  console.log(`   curl -X POST ${httpSource.getServerURL()}/test \\
     -H "Content-Type: application/json" \\
     -d '{"message": "Hello from curl!"}'\n`);

  // Test for 5 seconds
  const endTime = Date.now() + 5000;
  let requestCount = 0;

  while (Date.now() < endTime) {
    const event = await httpSource.pollNext();
    if (event && event.type === 'focus') {
      requestCount++;
      const httpEvent = event.data as any;
      console.log(`📩 Request ${requestCount}: ${httpEvent.method} ${httpEvent.path}`);
      console.log(`   From: ${httpEvent.remoteAddress}`);
      if (httpEvent.body) {
        console.log(`   Body: ${httpEvent.body.substring(0, 50)}...`);
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  httpSource.dispose();
  console.log(`\n✅ Test complete. Received ${requestCount} requests.\n`);
}

async function main() {
  const test = process.argv[2] || 'all';

  console.log('\n🧪 Event Sources Test Suite');
  console.log('═'.repeat(50));

  if (test === '1' || test === 'all') {
    await testFileWatcher();
  }

  if (test === '2' || test === 'all') {
    await testHTTPServer();
  }

  console.log('✅ All tests completed!\n');
}

main().catch(console.error);
