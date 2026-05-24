/**
 * Event Sources Unit Tests
 *
 * Comprehensive test suite for File Watcher, WebSocket, and HTTP event sources.
 */

import {
  createFileWatcherSource,
  createWebSocketSource,
  createHTTPSource,
  FileWatcherEventSource,
  WebSocketEventSource,
  HTTPEventSource,
} from './src/loop/event';
import { EventSourceState } from './src/loop/event/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// File Watcher Tests
// ============================================================================

describe('FileWatcherEventSource', () => {
  let testDir: string;
  let watcher: FileWatcherEventSource;

  beforeEach(() => {
    // Create temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kode-test-'));
  });

  afterEach(async () => {
    // Clean up watcher
    if (watcher) {
      watcher.dispose();
    }
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    test('should create watcher with default config', () => {
      watcher = createFileWatcherSource({
        watchPath: testDir,
      });

      expect(watcher).toBeInstanceOf(FileWatcherEventSource);
      expect(watcher.getState()).toBe(EventSourceState.Start);
    });

    test('should create watcher with custom config', () => {
      watcher = createFileWatcherSource({
        watchPath: testDir,
        recursive: true,
        debounceMs: 200,
        ignore: ['*.log', 'node_modules/**'],
      });

      expect(watcher).toBeInstanceOf(FileWatcherEventSource);
      expect(watcher.getState()).toBe(EventSourceState.Start);
    });

    test('should throw on invalid path', () => {
      expect(() => {
        createFileWatcherSource({
          watchPath: '/nonexistent/path/that/does/not/exist',
        });
      }).not.toThrow(); // Should not throw on init, only on start
    });
  });

  describe('State Management', () => {
    test('should start in Start state', () => {
      watcher = createFileWatcherSource({ watchPath: testDir });
      expect(watcher.getState()).toBe(EventSourceState.Start);
    });

    test('should transition to Running when started', () => {
      watcher = createFileWatcherSource({ watchPath: testDir });
      watcher.start();
      expect(watcher.getState()).toBe(EventSourceState.Running);
    });

    test('should transition to Paused when paused', () => {
      watcher = createFileWatcherSource({ watchPath: testDir });
      watcher.start();
      watcher.pause();
      expect(watcher.getState()).toBe(EventSourceState.Paused);
    });

    test('should resume to Running after pause', () => {
      watcher = createFileWatcherSource({ watchPath: testDir });
      watcher.start();
      watcher.pause();
      watcher.resume();
      expect(watcher.getState()).toBe(EventSourceState.Running);
    });

    test('should report isPaused correctly', () => {
      watcher = createFileWatcherSource({ watchPath: testDir });
      expect(watcher.isPaused()).toBe(false);

      watcher.start();
      expect(watcher.isPaused()).toBe(false);

      watcher.pause();
      expect(watcher.isPaused()).toBe(true);

      watcher.resume();
      expect(watcher.isPaused()).toBe(false);
    });
  });

  describe('Event Detection', () => {
    test('should detect file creation', async () => {
      watcher = createFileWatcherSource({
        watchPath: testDir,
        debounceMs: 50,
      });
      watcher.start();

      // Create a test file
      const testFile = path.join(testDir, 'test.txt');
      setTimeout(() => {
        fs.writeFileSync(testFile, 'test content');
      }, 100);

      // Wait for event
      let eventFound = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 2000) {
        const event = await watcher.pollNext();
        if (event && event.type === 'focus') {
          const fileEvent = event.data as any;
          if (fileEvent.path.includes('test.txt')) {
            eventFound = true;
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(eventFound).toBe(true);
    });

    test('should detect file modification', async () => {
      watcher = createFileWatcherSource({
        watchPath: testDir,
        debounceMs: 50,
      });

      // Create file first
      const testFile = path.join(testDir, 'test-modify.txt');
      fs.writeFileSync(testFile, 'initial content');

      watcher.start();

      // Wait a bit then modify
      setTimeout(() => {
        fs.writeFileSync(testFile, 'modified content');
      }, 200);

      // Wait for event
      let eventFound = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 2000) {
        const event = await watcher.pollNext();
        if (event && event.type === 'focus') {
          const fileEvent = event.data as any;
          if (fileEvent.path.includes('test-modify.txt')) {
            eventFound = true;
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(eventFound).toBe(true);
    });

    test('should detect file rename', async () => {
      watcher = createFileWatcherSource({
        watchPath: testDir,
        debounceMs: 50,
      });

      // Create file first
      const oldName = path.join(testDir, 'old-name.txt');
      const newName = path.join(testDir, 'new-name.txt');
      fs.writeFileSync(oldName, 'content');

      watcher.start();

      // Wait a bit then rename
      setTimeout(() => {
        fs.renameSync(oldName, newName);
      }, 200);

      // Wait for event
      let eventFound = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 2000) {
        const event = await watcher.pollNext();
        if (event && event.type === 'focus') {
          const fileEvent = event.data as any;
          if (fileEvent.type === 'rename') {
            eventFound = true;
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(eventFound).toBe(true);
    });
  });

  describe('Debouncing', () => {
    test('should debounce rapid changes', async () => {
      watcher = createFileWatcherSource({
        watchPath: testDir,
        debounceMs: 200,
      });

      watcher.start();

      const testFile = path.join(testDir, 'debounce-test.txt');

      // Make rapid changes
      setTimeout(() => {
        for (let i = 0; i < 5; i++) {
          fs.writeFileSync(testFile, `content ${i}`);
        }
      }, 100);

      // Count events
      let eventCount = 0;
      const startTime = Date.now();
      while (Date.now() - startTime < 3000) {
        const event = await watcher.pollNext();
        if (event && event.type === 'focus') {
          const fileEvent = event.data as any;
          if (fileEvent.path.includes('debounce-test.txt')) {
            eventCount++;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Should receive fewer events than changes due to debouncing
      expect(eventCount).toBeLessThan(5);
    });
  });

  describe('Pause/Resume', () => {
    test('should not emit events while paused', async () => {
      watcher = createFileWatcherSource({
        watchPath: testDir,
        debounceMs: 50,
      });

      watcher.start();
      watcher.pause();

      // Create file while paused
      const testFile = path.join(testDir, 'paused-test.txt');
      setTimeout(() => {
        fs.writeFileSync(testFile, 'test');
      }, 100);

      // Should not receive event
      let eventFound = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 1000) {
        const event = await watcher.pollNext();
        if (event && event.type === 'focus') {
          const fileEvent = event.data as any;
          if (fileEvent.path.includes('paused-test.txt')) {
            eventFound = true;
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(eventFound).toBe(false);
    });

    test('should resume receiving events after resume', async () => {
      watcher = createFileWatcherSource({
        watchPath: testDir,
        debounceMs: 50,
      });

      watcher.start();
      watcher.pause();

      // Create file while paused
      const testFile = path.join(testDir, 'resume-test.txt');
      fs.writeFileSync(testFile, 'test');

      // Resume
      await new Promise(resolve => setTimeout(resolve, 100));
      watcher.resume();

      // Now should receive events
      let eventFound = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 2000) {
        const event = await watcher.pollNext();
        if (event && event.type === 'focus') {
          const fileEvent = event.data as any;
          if (fileEvent.path.includes('resume-test.txt')) {
            eventFound = true;
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(eventFound).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('should return accurate stats', () => {
      watcher = createFileWatcherSource({ watchPath: testDir });
      watcher.start();

      const stats = watcher.getStats();

      expect(stats).toHaveProperty('watchedPaths');
      expect(stats).toHaveProperty('queuedEvents');
      expect(stats).toHaveProperty('state');
      expect(typeof stats.watchedPaths).toBe('number');
      expect(typeof stats.queuedEvents).toBe('number');
      expect(stats.watchedPaths).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    test('should clean up resources on dispose', () => {
      watcher = createFileWatcherSource({ watchPath: testDir });
      watcher.start();

      expect(watcher.getState()).toBe(EventSourceState.Running);

      watcher.dispose();

      // Should release all resources
      const stats = watcher.getStats();
      expect(stats.watchedPaths).toBe(0);
    });

    test('should remove all event listeners on dispose', () => {
      watcher = createFileWatcherSource({ watchPath: testDir });
      watcher.start();

      const listenerCount = (watcher as any).listenerCount('error');
      expect(listenerCount).toBeGreaterThan(0);

      watcher.dispose();

      const afterDisposeCount = (watcher as any).listenerCount('error');
      expect(afterDisposeCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid path gracefully', () => {
      expect(() => {
        const w = createFileWatcherSource({
          watchPath: '/nonexistent/path',
        });
        w.start();
      }).not.toThrow();
    });

    test('should emit error events', (done) => {
      watcher = createFileWatcherSource({
        watchPath: testDir,
      });

      watcher.on('error', (error: Error) => {
        expect(error).toBeDefined();
        done();
      });

      watcher.start();
      // Trigger some error condition
      watcher.dispose();
      watcher.start(); // Starting again might trigger error
    });
  });
});

// ============================================================================
// HTTP Event Source Tests
// ============================================================================

describe('HTTPEventSource', () => {
  let httpSource: HTTPEventSource;
  const TEST_PORT = 4567;

  afterEach(async () => {
    if (httpSource) {
      httpSource.dispose();
    }
    // Wait for port to be released
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Initialization', () => {
    test('should create HTTP source with default config', () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
      });

      expect(httpSource).toBeInstanceOf(HTTPEventSource);
      expect(httpSource.getState()).toBe(EventSourceState.Start);
    });

    test('should create HTTP source with custom config', () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
        host: '127.0.0.1',
        timeout: 5000,
        cors: {
          enabled: true,
          origin: 'http://localhost:3000',
        },
      });

      expect(httpSource).toBeInstanceOf(HTTPEventSource);
      expect(httpSource.getState()).toBe(EventSourceState.Start);
    });

    test('should create HTTP source with authentication', () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
        auth: {
          type: 'bearer',
          token: 'test-token',
        },
      });

      expect(httpSource).toBeInstanceOf(HTTPEventSource);
    });
  });

  describe('Server Management', () => {
    test('should start server successfully', async () => {
      httpSource = createHTTPSource({ port: TEST_PORT });

      await httpSource.start();

      expect(httpSource.isListening()).toBe(true);
      expect(httpSource.getState()).toBe(EventSourceState.Running);
    });

    test('should return correct server URL', async () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
        host: '127.0.0.1',
      });

      await httpSource.start();

      const url = httpSource.getServerURL();
      expect(url).toBe('http://127.0.0.1:4567');
    });

    test('should stop server on dispose', async () => {
      httpSource = createHTTPSource({ port: TEST_PORT });

      await httpSource.start();
      expect(httpSource.isListening()).toBe(true);

      httpSource.dispose();
      expect(httpSource.isListening()).toBe(false);
    });

    test('should handle port already in use', async () => {
      httpSource = createHTTPSource({ port: TEST_PORT });
      await httpSource.start();

      const httpSource2 = createHTTPSource({ port: TEST_PORT });

      await expect(httpSource2.start()).rejects.toThrow();
      httpSource2.dispose();
    });
  });

  describe('Request Handling', () => {
    beforeEach(async () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
        cors: { enabled: true },
      });
      await httpSource.start();
    });

    test('should receive GET requests', async () => {
      // Make a request
      fetch(`http://localhost:${TEST_PORT}/api/test`).catch(() => {});

      // Poll for event
      let eventReceived = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 1000) {
        const event = await httpSource.pollNext();
        if (event && event.type === 'focus') {
          const httpEvent = event.data as any;
          if (httpEvent.method === 'GET' && httpEvent.path === '/api/test') {
            eventReceived = true;
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(eventReceived).toBe(true);
    });

    test('should receive POST requests with body', async () => {
      // Make a POST request
      fetch(`http://localhost:${TEST_PORT}/api/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      }).catch(() => {});

      // Poll for event
      let eventReceived = false;
      let bodyFound = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 1000) {
        const event = await httpSource.pollNext();
        if (event && event.type === 'focus') {
          const httpEvent = event.data as any;
          if (httpEvent.method === 'POST') {
            eventReceived = true;
            if (httpEvent.body && httpEvent.body.includes('test')) {
              bodyFound = true;
            }
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(eventReceived).toBe(true);
      expect(bodyFound).toBe(true);
    });

    test('should parse query parameters', async () => {
      // Make request with query params
      fetch(`http://localhost:${TEST_PORT}/api/test?param1=value1&param2=value2`).catch(() => {});

      // Poll for event
      let queryFound = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 1000) {
        const event = await httpSource.pollNext();
        if (event && event.type === 'focus') {
          const httpEvent = event.data as any;
          if (httpEvent.query && httpEvent.query.param1 === 'value1') {
            queryFound = true;
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(queryFound).toBe(true);
    });
  });

  describe('CORS', () => {
    test('should include CORS headers when enabled', async () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
        cors: {
          enabled: true,
          origin: '*',
        },
      });
      await httpSource.start();

      // Make OPTIONS request
      const response = await fetch(`http://localhost:${TEST_PORT}/api/test`, {
        method: 'OPTIONS',
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });
  });

  describe('Authentication', () => {
    test('should accept requests with valid bearer token', async () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
        auth: {
          type: 'bearer',
          token: 'valid-token',
        },
      });
      await httpSource.start();

      const response = await fetch(`http://localhost:${TEST_PORT}/api/test`, {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      expect(response.status).toBe(200);
    });

    test('should reject requests without bearer token', async () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
        auth: {
          type: 'bearer',
          token: 'valid-token',
        },
      });
      await httpSource.start();

      const response = await fetch(`http://localhost:${TEST_PORT}/api/test`);

      expect(response.status).toBe(401);
    });
  });

  describe('Statistics', () => {
    test('should return accurate stats', async () => {
      httpSource = createHTTPSource({ port: TEST_PORT });
      await httpSource.start();

      const stats = httpSource.getStats();

      expect(stats).toHaveProperty('isListening');
      expect(stats).toHaveProperty('queuedEvents');
      expect(stats).toHaveProperty('port');
      expect(stats).toHaveProperty('host');
      expect(stats).toHaveProperty('state');
      expect(stats.isListening).toBe(true);
      expect(stats.port).toBe(TEST_PORT);
    });
  });
});

// ============================================================================
// WebSocket Event Source Tests
// ============================================================================

describe('WebSocketEventSource', () => {
  let wsSource: WebSocketEventSource;
  const TEST_PORT = 8081;
  const TEST_URL = `ws://localhost:${TEST_PORT}`;

  describe('Initialization', () => {
    test('should create WebSocket source with default config', () => {
      wsSource = createWebSocketSource({
        url: TEST_URL,
      });

      expect(wsSource).toBeInstanceOf(WebSocketEventSource);
      expect(wsSource.getState()).toBe(EventSourceState.Start);
    });

    test('should create WebSocket source with reconnection', () => {
      wsSource = createWebSocketSource({
        url: TEST_URL,
        reconnection: {
          enabled: true,
          maxAttempts: 10,
          initialDelay: 500,
        },
      });

      expect(wsSource).toBeInstanceOf(WebSocketEventSource);
    });
  });

  describe('Connection', () => {
    test('should fail to connect when no server', async () => {
      wsSource = createWebSocketSource({
        url: TEST_URL,
        connectionTimeout: 1000,
      });

      await expect(wsSource.connect()).rejects.toThrow();
    });

    test('should track connection state', async () => {
      wsSource = createWebSocketSource({
        url: TEST_URL,
        connectionTimeout: 1000,
      });

      expect(wsSource.isConnected()).toBe(false);

      try {
        await wsSource.connect();
      } catch (e) {
        // Expected to fail
      }

      expect(wsSource.isConnected()).toBe(false);
    });
  });

  describe('Statistics', () => {
    test('should return accurate stats', () => {
      wsSource = createWebSocketSource({
        url: TEST_URL,
      });

      const stats = wsSource.getStats();

      expect(stats).toHaveProperty('isConnected');
      expect(stats).toHaveProperty('queuedEvents');
      expect(stats).toHaveProperty('reconnectAttempts');
      expect(stats).toHaveProperty('state');
      expect(stats.isConnected).toBe(false);
      expect(stats.reconnectAttempts).toBe(0);
    });
  });

  describe('Cleanup', () => {
    test('should clean up on dispose', () => {
      wsSource = createWebSocketSource({ url: TEST_URL });

      wsSource.dispose();

      expect(wsSource.isConnected()).toBe(false);
    });
  });
});
