# Event Sources Guide

**Version**: 2.1.0
**Status**: Complete
**Based on**: Codex CLI Event Stream Architecture

## Overview

Newma (牛码)'s event stream system now supports **multiple event sources** beyond the traditional readline interface. This enables powerful use cases like:

- 📁 **File Watching**: Monitor file system changes in real-time
- 🔌 **WebSocket**: Connect to remote event streams
- 🌐 **HTTP Webhooks**: Receive events from external services
- ⏸️ **Pause/Resume**: Full control over event flow

## Quick Start

### Installation

```bash
# Install dependencies (includes WebSocket support)
npm install
```

### Basic Usage

```typescript
import {
  createFileWatcherSource,
  createWebSocketSource,
  createHTTPSource,
} from './src/loop/event';

// 1. File Watcher
const watcher = createFileWatcherSource({
  watchPath: './src',
  recursive: true,
});

watcher.start();
while (running) {
  const event = await watcher.pollNext();
  if (event) {
    console.log('File changed:', event.data);
  }
}

// 2. WebSocket
const wsSource = createWebSocketSource({
  url: 'ws://localhost:8080/events',
  reconnection: { enabled: true },
});

await wsSource.connect();

// 3. HTTP Webhook
const httpSource = createHTTPSource({
  port: 3000,
  cors: { enabled: true },
});

await httpSource.start();
```

## Event Sources

### 1. File Watcher Event Source

Monitors file system changes and emits events when files are modified or renamed.

#### Features

- ✅ **Recursive Watching**: Monitor entire directory trees
- ✅ **Debouncing**: Prevent duplicate events for rapid changes
- ✅ **Ignore Patterns**: Exclude files/directories by glob patterns
- ✅ **Pause/Resume**: Stop/start event emission
- ✅ **Event Filtering**: Choose which event types to watch

#### Configuration

```typescript
interface FileWatcherConfig {
  /**
   * Path to watch (file or directory)
   */
  watchPath: string;

  /**
   * Watch recursively (for directories)
   */
  recursive?: boolean;

  /**
   * Event types to watch
   */
  watchEvents?: ('change' | 'rename')[];

  /**
   * Debounce delay in milliseconds
   */
  debounceMs?: number;

  /**
   * Ignore patterns (glob patterns)
   */
  ignore?: string[];
}
```

#### Example

```typescript
import { createFileWatcherSource } from './src/loop/event';

const watcher = createFileWatcherSource({
  watchPath: './src',
  recursive: true,
  debounceMs: 100,
  ignore: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '*.log',
  ],
});

watcher.start();

while (running) {
  const event = await watcher.pollNext();
  if (event) {
    const fileEvent = event.data as FileWatcherEvent;
    console.log(`File ${fileEvent.type}: ${fileEvent.path}`);
    console.log(`Time: ${new Date(fileEvent.timestamp).toLocaleString()}`);
  }
}
```

#### Event Structure

```typescript
interface FileWatcherEvent {
  type: 'change' | 'rename';  // Event type
  path: string;                // Full path to changed file
  timestamp: number;           // Unix timestamp
}
```

#### Use Cases

- **Hot Reload**: Restart services when code changes
- **Build Triggers**: Automatically rebuild on file changes
- **Logging**: Track file modifications
- **Sync Systems**: Detect changes for synchronization

---

### 2. WebSocket Event Source

Connects to a WebSocket server and receives real-time events from remote sources.

#### Features

- ✅ **Real-time Events**: Low-latency event streaming
- ✅ **Auto-Reconnection**: Exponential backoff retry logic
- ✅ **Bi-directional**: Send and receive messages
- ✅ **Connection State**: Track connection status
- ✅ **Timeout Control**: Configurable connection timeouts

#### Configuration

```typescript
interface WebSocketSourceConfig {
  /**
   * WebSocket server URL
   */
  url: string;

  /**
   * Connection timeout in milliseconds
   */
  connectionTimeout?: number;

  /**
   * Reconnection settings
   */
  reconnection?: {
    enabled: boolean;
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
  };

  /**
   * WebSocket protocols
   */
  protocols?: string | string[];

  /**
   * Custom headers
   */
  headers?: Record<string, string>;
}
```

#### Example

```typescript
import { createWebSocketSource } from './src/loop/event';

const wsSource = createWebSocketSource({
  url: 'ws://localhost:8080/events',
  connectionTimeout: 10000,
  reconnection: {
    enabled: true,
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
  },
  protocols: 'event-stream',
});

await wsSource.connect();

while (running) {
  const event = await wsSource.pollNext();
  if (event) {
    const wsEvent = event.data as WebSocketEvent;
    console.log(`Message: ${wsEvent.data}`);
    console.log(`From: ${wsEvent.origin}`);

    // Send response
    wsSource.send(JSON.stringify({ received: true }));
  }
}
```

#### Event Structure

```typescript
interface WebSocketEvent {
  type: 'message' | 'error' | 'close';
  data: string;              // Message content
  timestamp: number;         // Unix timestamp
  origin: string;            // Server URL
}
```

#### Use Cases

- **Remote Monitoring**: Receive events from remote servers
- **Collaborative Editing**: Sync changes across multiple clients
- **Live Updates**: Real-time dashboards and monitoring
- **Chat Systems**: Instant messaging applications

---

### 3. HTTP Event Source

Creates an HTTP server to receive webhook-style events from external services.

#### Features

- ✅ **Webhook Receiver**: Accept HTTP POST/GET requests
- ✅ **CORS Support**: Cross-origin resource sharing
- ✅ **Authentication**: Bearer token and basic auth
- ✅ **Query Parsing**: Extract query parameters
- ✅ **Custom Responses**: Configurable success responses

#### Configuration

```typescript
interface HTTPSourceConfig {
  /**
   * Port to listen on
   */
  port: number;

  /**
   * Host to bind to
   */
  host?: string;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * CORS settings
   */
  cors?: {
    enabled: boolean;
    origin?: string;
    methods?: string[];
    headers?: string[];
  };

  /**
   * Authentication (optional)
   */
  auth?: {
    type: 'bearer' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };

  /**
   * Response body for successful requests
   */
  successResponse?: {
    statusCode: number;
    body: string;
  };
}
```

#### Example

```typescript
import { createHTTPSource } from './src/loop/event';

const httpSource = createHTTPSource({
  port: 3000,
  host: '0.0.0.0',
  timeout: 30000,
  cors: {
    enabled: true,
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    headers: ['Content-Type', 'Authorization'],
  },
  auth: {
    type: 'bearer',
    token: 'your-secret-token',
  },
  successResponse: {
    statusCode: 200,
    body: JSON.stringify({ success: true, message: 'Event received' }),
  },
});

await httpSource.start();
console.log(`Server listening on ${httpSource.getServerURL()}`);

while (running) {
  const event = await httpSource.pollNext();
  if (event) {
    const httpEvent = event.data as HTTPEvent;
    console.log(`${httpEvent.method} ${httpEvent.path}`);
    console.log(`Query: ${JSON.stringify(httpEvent.query)}`);
    if (httpEvent.body) {
      console.log(`Body: ${httpEvent.body}`);
    }
  }
}
```

#### Event Structure

```typescript
interface HTTPEvent {
  type: 'request';
  method: string;                      // HTTP method
  path: string;                        // Request path
  headers: Record<string, string>;     // HTTP headers
  body?: string;                       // Request body
  query: Record<string, string>;       // Query parameters
  timestamp: number;                   // Unix timestamp
  remoteAddress?: string;              // Client IP address
}
```

#### Use Cases

- **CI/CD Integration**: Receive build/deployment notifications
- **Payment Processing**: Handle webhook notifications (Stripe, PayPal)
- **Third-party Integrations**: Connect with external APIs
- **Event Logging**: Centralized event collection

---

## Advanced Usage

### Multiple Event Sources

Combine multiple event sources to create comprehensive event-driven systems:

```typescript
import {
  createFileWatcherSource,
  createHTTPSource,
  createWebSocketSource,
} from './src/loop/event';

// Create multiple sources
const watcher = createFileWatcherSource({ watchPath: './src' });
const httpSource = createHTTPSource({ port: 3000 });
const wsSource = createWebSocketSource({ url: 'ws://localhost:8080' });

// Start all sources
watcher.start();
await httpSource.start();
await wsSource.connect();

// Poll from all sources
while (running) {
  const fileEvent = await watcher.pollNext();
  if (fileEvent) console.log('File:', fileEvent.data);

  const httpEvent = await httpSource.pollNext();
  if (httpEvent) console.log('HTTP:', httpEvent.data);

  const wsEvent = await wsSource.pollNext();
  if (wsEvent) console.log('WS:', wsEvent.data);

  if (!fileEvent && !httpEvent && !wsEvent) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
```

### Pause/Resume

All event sources support pause/resume functionality:

```typescript
const watcher = createFileWatcherSource({ watchPath: './src' });
watcher.start();

// Pause (events will be queued or dropped)
watcher.pause();

// Do some work without interruption
await someLongRunningTask();

// Resume (start receiving events again)
watcher.resume();
```

### Error Handling

Handle errors gracefully:

```typescript
const watcher = createFileWatcherSource({ watchPath: './src' });

watcher.on('error', (error) => {
  console.error('Watcher error:', error.message);
});

watcher.on('started', () => {
  console.log('Watcher started');
});

watcher.on('paused', () => {
  console.log('Watcher paused');
});

watcher.on('resumed', () => {
  console.log('Watcher resumed');
});
```

### Statistics

Get runtime statistics from event sources:

```typescript
// File Watcher
const fileStats = watcher.getStats();
console.log(`Watching ${fileStats.watchedPaths} paths`);
console.log(`${fileStats.queuedEvents} events queued`);

// WebSocket
const wsStats = wsSource.getStats();
console.log(`Connected: ${wsStats.isConnected}`);
console.log(`Reconnect attempts: ${wsStats.reconnectAttempts}`);

// HTTP
const httpStats = httpSource.getStats();
console.log(`Listening on ${httpStats.host}:${httpStats.port}`);
console.log(`${httpStats.queuedEvents} requests queued`);
```

---

## Integration with REPL

Event sources can be integrated into Newma (牛码)'s REPL v2:

```typescript
import { REPLManagerV2 } from './src/repl-v2';
import { createFileWatcherSource } from './src/loop/event';

// Start REPL
const repl = new REPLManagerV2(session);

// Create file watcher
const watcher = createFileWatcherSource({
  watchPath: './src',
  recursive: true,
});

// Integrate with REPL's event broker
repl.getEventSystem().broker.setSource(watcher);

// Start REPL
await repl.start();

// Now file changes will trigger REPL events
```

---

## Examples

Run the provided examples:

```bash
# Example 1: File Watcher
npx ts-node examples/event-sources.ts 1

# Example 2: WebSocket
npx ts-node examples/event-sources.ts 2

# Example 3: HTTP Webhook
npx ts-node examples/event-sources.ts 3

# Example 4: Multiple Sources
npx ts-node examples/event-sources.ts 4

# Example 5: Pause/Resume
npx ts-node examples/event-sources.ts 5
```

---

## Performance Considerations

### File Watcher

- **Memory**: ~10-20KB per watched path
- **CPU**: Minimal (< 1% with debounce)
- **Debouncing**: Essential for high-frequency changes
- **Ignore Patterns**: Use to reduce noise

### WebSocket

- **Memory**: ~50-100KB per connection
- **Network**: Depends on message frequency
- **Reconnection**: Exponential backoff prevents server overload
- **Message Size**: Consider splitting large messages

### HTTP

- **Memory**: ~100-200KB for server
- **Concurrency**: Node.js handles well by default
- **Timeouts**: Set appropriate timeouts to prevent hanging
- **CORS**: Enable only when needed for security

---

## Best Practices

### File Watcher

1. **Always Use Debouncing**: Prevents event storms
2. **Ignore Unnecessary Paths**: Exclude node_modules, .git, etc.
3. **Check Stats**: Monitor queued events count
4. **Handle Permissions**: Some directories require elevated access

### WebSocket

1. **Enable Reconnection**: Network issues are common
2. **Set Timeouts**: Prevent infinite waiting
3. **Handle Authentication**: Secure your connections
4. **Test Connectivity**: Verify server is reachable

### HTTP

1. **Use CORS Carefully**: Restrict origins in production
2. **Enable Authentication**: Protect webhook endpoints
3. **Validate Input**: Check request data before processing
4. **Log Requests**: Track incoming webhooks for debugging

---

## Troubleshooting

### File Watcher Issues

**Problem**: No events received

**Solutions**:
- Check file path exists
- Verify file system permissions
- Ensure ignore patterns aren't too broad
- Check if watcher is paused

### WebSocket Issues

**Problem**: Connection fails

**Solutions**:
- Verify server URL is correct
- Check firewall/network settings
- Ensure server supports WebSocket protocol
- Review authentication credentials

**Problem**: Frequent disconnections

**Solutions**:
- Enable auto-reconnection
- Increase timeout values
- Check server health
- Review network stability

### HTTP Issues

**Problem**: Server won't start

**Solutions**:
- Check if port is already in use
- Verify binding address (0.0.0.0 vs localhost)
- Check firewall rules
- Ensure proper permissions

**Problem**: CORS errors

**Solutions**:
- Enable CORS in configuration
- Set correct origin header
- Verify methods and headers
- Check browser console for details

---

## Comparison

| Feature | File Watcher | WebSocket | HTTP |
|---------|--------------|-----------|------|
| **Latency** | Low | Very Low | Medium |
| **Setup** | Simple | Medium | Simple |
| **Scalability** | Medium | High | High |
| **Reliability** | High | Medium | High |
| **Bi-directional** | No | Yes | No |
| **Authentication** | No | Yes | Yes |
| **Best For** | Local files | Real-time sync | Webhooks |

---

## Future Enhancements

- [ ] Custom event source plugin system
- [ ] Event filtering and transformation
- [ ] Event replay and recording
- [ ] Multi-process event distribution
- [ ] Event aggregation and batching
- [ ] Performance monitoring dashboard

---

## References

- **Architecture**: `docs/EVENT_STREAM_ARCHITECTURE.md`
- **Quickstart**: `docs/EVENT_STREAM_QUICKSTART.md`
- **Examples**: `examples/event-sources.ts`
- **Type Definitions**: `src/loop/event/types.ts`

---

**Last Updated**: 2026-01-25
**Version**: 2.1.0
**Maintained By**: Newma (牛码) Development Team
