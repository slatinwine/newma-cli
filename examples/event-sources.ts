/**
 * Event Sources Examples
 *
 * Demonstrates how to use different event sources in Kode's event stream system.
 */

import {
  // Core event system
  createEventSystem,
  EventBroker,
  EventStream,
  waitForEvent,
  isQuitEvent,

  // Event source factories
  createFileWatcherSource,
  createWebSocketSource,
  createHTTPSource,

  // Event source classes
  FileWatcherEventSource,
  WebSocketEventSource,
  HTTPEventSource,

  // Types
  UIEvent,
  FileWatcherEvent,
  WebSocketEvent,
  HTTPEvent,
} from '../src/loop/event';

// ============================================================================
// Example 1: File Watcher Event Source
// ============================================================================

/**
 * Example 1: Watch for file changes in a directory
 */
async function example1_fileWatcher() {
  console.log('\n📁 Example 1: File Watcher Event Source');
  console.log('═════════════════════════════════════════\n');

  // Create file watcher for src directory
  const watcher = createFileWatcherSource({
    watchPath: './src',
    recursive: true,
    debounceMs: 100,
    ignore: ['node_modules/**', '.git/**', 'dist/**'],
  });

  // Start watching
  watcher.start();

  console.log('👀 Watching ./src for changes...');
  console.log('✏️  Try editing a file in ./src\n');
  console.log('Press Ctrl+C to stop\n');

  // Poll for events
  let running = true;
  const timeout = setTimeout(() => {
    running = false;
    watcher.dispose();
    console.log('\n⏱️  Timeout - stopping watcher\n');
  }, 30000); // Run for 30 seconds

  while (running) {
    const event = await watcher.pollNext();
    if (event) {
      const fileEvent = event.data as FileWatcherEvent;
      console.log(`📝 File ${fileEvent.type}: ${fileEvent.path}`);
      console.log(`   Time: ${new Date(fileEvent.timestamp).toLocaleTimeString()}\n`);
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  clearTimeout(timeout);
}

// ============================================================================
// Example 2: WebSocket Event Source
// ============================================================================

/**
 * Example 2: Connect to a WebSocket server for real-time events
 */
async function example2_webSocket() {
  console.log('\n🔌 Example 2: WebSocket Event Source');
  console.log('═════════════════════════════════════════\n');

  // Create WebSocket source
  const wsSource = createWebSocketSource({
    url: 'ws://localhost:8080/events',
    reconnection: {
      enabled: true,
      maxAttempts: 5,
      initialDelay: 1000,
      maxDelay: 10000,
    },
  });

  try {
    // Connect to server
    console.log('🔗 Connecting to ws://localhost:8080/events...');
    await wsSource.connect();
    console.log('✅ Connected!\n');

    // Listen for events
    let running = true;
    const timeout = setTimeout(() => {
      running = false;
      wsSource.dispose();
      console.log('\n⏱️  Timeout - disconnecting\n');
    }, 30000);

    while (running) {
      const event = await wsSource.pollNext();
      if (event) {
        const wsEvent = event.data as WebSocketEvent;
        console.log(`📨 WebSocket ${wsEvent.type}:`);
        console.log(`   Data: ${wsEvent.data.substring(0, 100)}...`);
        console.log(`   From: ${wsEvent.origin}\n`);

        // Send response back
        wsSource.send(JSON.stringify({ received: true }));
      } else {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    clearTimeout(timeout);
  } catch (error: any) {
    console.error(`❌ WebSocket error: ${error.message}`);
    console.log('💡 Make sure a WebSocket server is running on ws://localhost:8080\n');
  }
}

// ============================================================================
// Example 3: HTTP Event Source (Webhook Receiver)
// ============================================================================

/**
 * Example 3: Create an HTTP server to receive webhook events
 */
async function example3_httpWebhook() {
  console.log('\n🌐 Example 3: HTTP Event Source (Webhook)');
  console.log('═════════════════════════════════════════\n');

  // Create HTTP source
  const httpSource = createHTTPSource({
    port: 3000,
    host: '0.0.0.0',
    cors: {
      enabled: true,
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
    successResponse: {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Event received' }),
    },
  });

  // Start server
  await httpSource.start();
  console.log(`🚀 HTTP server listening on ${httpSource.getServerURL()}`);
  console.log('\n📥 Test with curl:');
  console.log(`   curl -X POST ${httpSource.getServerURL()}/webhook \\
     -H "Content-Type: application/json" \\
     -d '{"test": "data"}'\n`);
  console.log('Press Ctrl+C to stop\n');

  // Listen for events
  let running = true;
  const timeout = setTimeout(() => {
    running = false;
    httpSource.dispose();
    console.log('\n⏱️  Timeout - stopping server\n');
  }, 60000); // Run for 60 seconds

  while (running) {
    const event = await httpSource.pollNext();
    if (event) {
      const httpEvent = event.data as HTTPEvent;
      console.log(`📩 HTTP ${httpEvent.method} ${httpEvent.path}`);
      console.log(`   Query: ${JSON.stringify(httpEvent.query)}`);
      if (httpEvent.body) {
        console.log(`   Body: ${httpEvent.body.substring(0, 100)}...`);
      }
      console.log(`   From: ${httpEvent.remoteAddress}\n`);
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  clearTimeout(timeout);
}

// ============================================================================
// Example 4: Multiple Event Sources with EventBroker
// ============================================================================

/**
 * Example 4: Combine multiple event sources using EventBroker
 */
async function example4_multipleSources() {
  console.log('\n🎛️  Example 4: Multiple Event Sources');
  console.log('═════════════════════════════════════════\n');

  // Create file watcher
  const watcher = createFileWatcherSource({
    watchPath: './src',
    recursive: false,
  });
  watcher.start();

  // Create HTTP source
  const httpSource = createHTTPSource({
    port: 3001,
    cors: { enabled: true },
  });
  await httpSource.start();

  console.log('✅ Watching ./src for file changes');
  console.log(`✅ HTTP server on ${httpSource.getServerURL()}`);
  console.log('\nBoth sources are now active. Try:\n');
  console.log('1. Edit a file in ./src');
  console.log(`2. Send HTTP request: curl ${httpSource.getServerURL()}/test`);
  console.log('\nPress Ctrl+C to stop\n');

  // Poll from both sources
  let running = true;
  const timeout = setTimeout(() => {
    running = false;
    watcher.dispose();
    httpSource.dispose();
    console.log('\n⏱️  Timeout - stopping all sources\n');
  }, 30000);

  while (running) {
    // Poll file watcher
    const fileEvent = await watcher.pollNext();
    if (fileEvent) {
      const data = fileEvent.data as FileWatcherEvent;
      console.log(`📁 File: ${data.type} - ${data.path}`);
    }

    // Poll HTTP source
    const httpEvent = await httpSource.pollNext();
    if (httpEvent) {
      const data = httpEvent.data as HTTPEvent;
      console.log(`🌐 HTTP: ${data.method} ${data.path}`);
    }

    if (!fileEvent && !httpEvent) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  clearTimeout(timeout);
}

// ============================================================================
// Example 5: Pause/Resume Event Sources
// ============================================================================

/**
 * Example 5: Demonstrate pause/resume functionality
 */
async function example5_pauseResume() {
  console.log('\n⏸️  Example 5: Pause/Resume Event Sources');
  console.log('═════════════════════════════════════════\n');

  const watcher = createFileWatcherSource({
    watchPath: './src',
    recursive: false,
  });
  watcher.start();

  console.log('✅ Watching ./src\n');

  // Let it run for 5 seconds
  console.log('⏳ Monitoring for 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Pause
  console.log('\n⏸️  Pausing watcher (events will be queued)...');
  watcher.pause();

  // Wait 3 seconds (try editing files during this time)
  console.log('⏳ Paused for 3 seconds (try editing files now)');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Resume
  console.log('\n▶️  Resuming watcher...');
  watcher.resume();

  // Check if any events were queued
  const stats = watcher.getStats();
  console.log(`📊 Stats: ${stats.queuedEvents} queued events\n`);

  // Process any queued events
  let processed = 0;
  const startTime = Date.now();
  while (Date.now() - startTime < 5000) {
    const event = await watcher.pollNext();
    if (event) {
      const data = event.data as FileWatcherEvent;
      console.log(`📝 Processed queued event: ${data.path}`);
      processed++;
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n✅ Processed ${processed} queued events`);
  watcher.dispose();
}

// ============================================================================
// Run Examples
// ============================================================================

/**
 * Main entry point - run selected example
 */
async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || '1';

  const examples: Record<string, () => Promise<void>> = {
    '1': example1_fileWatcher,
    '2': example2_webSocket,
    '3': example3_httpWebhook,
    '4': example4_multipleSources,
    '5': example5_pauseResume,
  };

  const selectedExample = examples[example];
  if (selectedExample) {
    try {
      await selectedExample();
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log('\n❓ Unknown example. Available examples:\n');
    console.log('1  - File Watcher');
    console.log('2  - WebSocket');
    console.log('3  - HTTP Webhook');
    console.log('4  - Multiple Sources');
    console.log('5  - Pause/Resume\n');
    console.log('Usage: npx ts-node examples/event-sources.ts <example-number>\n');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_fileWatcher,
  example2_webSocket,
  example3_httpWebhook,
  example4_multipleSources,
  example5_pauseResume,
};
